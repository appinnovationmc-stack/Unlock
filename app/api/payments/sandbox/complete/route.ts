import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sandboxProvider } from "@/lib/payments/sandbox";

/**
 * TEST ONLY — completes a sandbox payment and credits the org balance.
 * Never available in production payment mode.
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  if (process.env.PAYMENT_PROVIDER === "paystack" && process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_")) {
    return NextResponse.json({ error: "Sandbox complete disabled in live mode" }, { status: 403 });
  }

  const ref = req.nextUrl.searchParams.get("ref");
  if (!ref || !ref.startsWith("sandbox_")) {
    return NextResponse.json({ error: "Invalid sandbox reference" }, { status: 400 });
  }

  const status = await sandboxProvider.completeSandboxPayment(ref);
  if (status.status !== "succeeded") {
    return NextResponse.json({ error: status.failureReason || "Complete failed" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: intent } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("provider_reference", ref)
    .maybeSingle();

  if (!intent) {
    return NextResponse.redirect(new URL("/billing?payment=unknown", req.url));
  }

  if (intent.status !== "succeeded") {
    await supabase
      .from("payment_intents")
      .update({
        status: "succeeded",
        succeeded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", intent.id);

    const { data: account } = await supabase
      .from("org_financial_accounts")
      .select("*")
      .eq("org_id", intent.org_id)
      .maybeSingle();

    if (!account) {
      await supabase.from("org_financial_accounts").insert({
        org_id: intent.org_id,
        currency: intent.currency,
        available_balance_cents: intent.amount_cents,
        lifetime_deposited_cents: intent.amount_cents
      });
    } else {
      await supabase
        .from("org_financial_accounts")
        .update({
          available_balance_cents: Number(account.available_balance_cents) + Number(intent.amount_cents),
          lifetime_deposited_cents: Number(account.lifetime_deposited_cents) + Number(intent.amount_cents),
          updated_at: new Date().toISOString()
        })
        .eq("org_id", intent.org_id);
    }

    await supabase.from("financial_ledger").insert({
      entry_type: "brand_deposit",
      org_id: intent.org_id,
      campaign_id: intent.campaign_id,
      amount_cents: intent.amount_cents,
      currency: intent.currency,
      status: "completed",
      description: "Sandbox payment completed (TEST)",
      reference_type: "payment_intent",
      reference_id: intent.id,
      payment_provider: "sandbox",
      provider_reference: ref
    });
  }

  const redirect = new URL("/billing?payment=success&sandbox=1", req.url);
  return NextResponse.redirect(redirect);
}
