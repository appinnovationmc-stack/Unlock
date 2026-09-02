import { NextResponse } from "next/server";
import { isPushSendReady, vapidPublicKey } from "@/lib/push/config";

/** Public key is returned only when the private key is also present. */
export async function GET() {
  const ready = isPushSendReady();
  return NextResponse.json({
    ready,
    publicKey: ready ? vapidPublicKey() ?? null : null
  });
}
