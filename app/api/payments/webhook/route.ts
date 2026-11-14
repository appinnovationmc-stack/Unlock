import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const provider = getPaymentProvider();
    if (provider.name !== "paystack") return NextResponse.json({ error: "Provider disabled" }, { status: 403 });
    const modern = req.headers.get("paystack-signature");
    const signature = modern || req.headers.get("x-paystack-signature");
    const secret = modern
      ? [process.env.PAYSTACK_WEBHOOK_SECRET, process.env.PAYSTACK_WEBHOOK_PREVIOUS_SECRET].filter(Boolean).join(",")
      : process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Signing secret unavailable");
    const raw = Buffer.from(await req.arrayBuffer());
    const verified = await provider.verifyWebhook(raw, signature, secret);
    if (!verified.valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    const admin = createAdminClient();
    if (!admin) throw new Error("Settlement service unavailable");
    const { error } = await admin.rpc("process_payment_event", {
      p_event_id: verified.eventId, p_event_type: verified.eventType,
      p_payload: verified.payload, p_is_sandbox: provider.isSandbox
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[payment settlement]", error instanceof Error ? error.message : "Failed");
    return NextResponse.json({ error: "Payment processing unavailable; retry required" }, { status: 503 });
  }
}
