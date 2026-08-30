import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sandboxProvider } from "@/lib/payments/sandbox";

/**
 * TEST ONLY — completes a sandbox payment and credits the org balance.
 * Never available in production payment mode.
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
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

    const { error: creditErr } = await supabase.rpc("credit_org_deposit", {
      p_org_id: intent.org_id,
      p_amount_cents: intent.amount_cents,
      p_currency: intent.currency,
      p_campaign_id: intent.campaign_id,
      p_reference_type: "payment_intent",
      p_reference_id: intent.id,
      p_payment_provider: "sandbox",
      p_provider_reference: ref,
      p_description: "Sandbox payment completed (TEST)"
    });

    if (creditErr) {
      console.error("[sandbox-complete] credit_org_deposit failed", creditErr);
      return NextResponse.redirect(new URL("/billing?payment=error", req.url));
    }
  }

  const redirect = new URL("/billing?payment=success&sandbox=1", req.url);
  return NextResponse.redirect(redirect);
}
