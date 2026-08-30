import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPaymentProvider } from "@/lib/payments";

/**
 * Payment provider webhooks.
 * Signature verification is mandatory.
 * Processing is idempotent via payment_webhook_events unique (provider, event_id).
 * Browser is never trusted for payment success.
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    // Never silently fall back to the anon key for a path that writes
    // financial data — fail loudly so misconfiguration is caught immediately.
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured — refusing to process payment webhook");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const providerName = req.nextUrl.searchParams.get("provider") || "paystack";
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-paystack-signature") ||
    req.headers.get("x-webhook-signature") ||
    req.headers.get("signature");

  const provider = getPaymentProvider();
  if (provider.name !== providerName && providerName !== "sandbox") {
    // still try if configured
  }

  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // A hardcoded fallback here would mean anyone who knows the fallback
    // string could forge a valid "payment succeeded" signature. Refuse
    // instead of silently trusting an unverifiable webhook.
    console.error("[webhook] no webhook secret configured — rejecting request");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const verification = await provider.verifyWebhook(rawBody, signature, webhookSecret);

  if (!verification.valid) {
    return NextResponse.json({ error: verification.error || "Invalid signature" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Idempotent insert
  const { data: existing } = await supabase
    .from("payment_webhook_events")
    .select("id, processed")
    .eq("provider", providerName)
    .eq("event_id", verification.eventId)
    .maybeSingle();

  if (existing?.processed) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { data: eventRow, error: insertErr } = await supabase
    .from("payment_webhook_events")
    .upsert(
      {
        provider: providerName,
        event_id: verification.eventId,
        event_type: verification.eventType,
        payload: verification.payload as object,
        signature_valid: true,
        processed: false
      },
      { onConflict: "provider,event_id" }
    )
    .select("id")
    .single();

  if (insertErr) {
    console.error("[webhook] insert failed", insertErr);
    return NextResponse.json({ error: "Store failed" }, { status: 500 });
  }

  try {
    await processWebhookEvent(supabase, providerName, verification.eventType, verification.payload);
    await supabase
      .from("payment_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("id", eventRow.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Processing error";
    await supabase
      .from("payment_webhook_events")
      .update({ processing_error: msg })
      .eq("id", eventRow.id);
    console.error("[webhook] process error", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function processWebhookEvent(
  supabase: ReturnType<typeof getServiceClient>,
  provider: string,
  eventType: string,
  payload: unknown
) {
  const p = payload as {
    data?: {
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
      paid_at?: string;
      metadata?: { org_id?: string; campaign_id?: string; purpose?: string };
    };
    event?: string;
  };

  const reference = p.data?.reference;
  if (!reference) return;

  const { data: intent } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (!intent) {
    console.warn("[webhook] no matching payment_intent for", reference);
    return;
  }

  const successEvents = ["charge.success", "payment.success", "transaction.success"];
  const failEvents = ["charge.failed", "payment.failed", "transaction.failed"];

  if (successEvents.includes(eventType) || p.data?.status === "success") {
    if (intent.status === "succeeded") return; // already handled

    await supabase
      .from("payment_intents")
      .update({
        status: "succeeded",
        succeeded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", intent.id);

    // Credit org financial account atomically — avoids a lost-update race
    // when the payment provider retries webhook delivery concurrently.
    const { error: creditErr } = await supabase.rpc("credit_org_deposit", {
      p_org_id: intent.org_id,
      p_amount_cents: intent.amount_cents,
      p_currency: intent.currency
    });

    if (creditErr) {
      throw new Error(`credit_org_deposit failed: ${creditErr.message}`);
    }

    await supabase.from("financial_ledger").insert({
      entry_type: "brand_deposit",
      org_id: intent.org_id,
      campaign_id: intent.campaign_id,
      amount_cents: intent.amount_cents,
      currency: intent.currency,
      status: "completed",
      description: `Payment received via ${provider}`,
      reference_type: "payment_intent",
      reference_id: intent.id,
      payment_provider: provider,
      provider_reference: reference
    });

    await supabase.from("finance_audit_log").insert({
      org_id: intent.org_id,
      action: "payment_received",
      entity_type: "payment_intent",
      entity_id: intent.id,
      metadata: { amount_cents: intent.amount_cents, provider, reference }
    });
  } else if (failEvents.includes(eventType) || p.data?.status === "failed") {
    await supabase
      .from("payment_intents")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        failure_reason: "Provider reported failure",
        updated_at: new Date().toISOString()
      })
      .eq("id", intent.id);
  }
}
