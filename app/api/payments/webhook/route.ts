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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  if (!key) {
    // Never fall back to the anon key here: writes to financial tables are
    // only reachable via SECURITY DEFINER RPCs or the service role, and a
    // silent anon-key fallback should fail loudly, not degrade quietly.
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
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

  // The sandbox provider ignores the secret entirely (it just parses JSON),
  // so it's safe to run without one. Any real provider (Paystack) verifies
  // an HMAC signature against it — silently falling back to a hardcoded
  // string here would mean anyone who has ever seen this repo (it's in git
  // history) could forge a valid "payment succeeded" webhook. Hard-fail
  // instead.
  if (!provider.isSandbox && !webhookSecret) {
    console.error("[webhook] missing webhook secret for non-sandbox provider", providerName);
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const verification = await provider.verifyWebhook(rawBody, signature, webhookSecret || "");

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

    // Credit org financial account: single atomic RPC (see migration
    // 00000011_atomic_deposit_credit.sql). Handles account creation, the
    // balance increment, the ledger row, and the audit log entry in one
    // transaction, and is safe against concurrent webhook retries for the
    // same payment_intent (DB-level unique index, not just the
    // payment_webhook_events check above).
    const { error: creditErr } = await supabase.rpc("credit_org_deposit", {
      p_org_id: intent.org_id,
      p_amount_cents: intent.amount_cents,
      p_currency: intent.currency,
      p_campaign_id: intent.campaign_id,
      p_reference_type: "payment_intent",
      p_reference_id: intent.id,
      p_payment_provider: provider,
      p_provider_reference: reference,
      p_description: `Payment received via ${provider}`
    });

    if (creditErr) {
      throw new Error(`credit_org_deposit failed: ${creditErr.message}`);
    }
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
