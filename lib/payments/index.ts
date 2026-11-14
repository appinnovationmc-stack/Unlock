import type { PaymentProvider, PayoutProvider } from "./types";
import { sandboxProvider } from "./sandbox";
import { createPaystackProvider } from "./paystack";
export * from "./types";
export { sandboxProvider } from "./sandbox";

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER;
  const mode = process.env.PAYMENT_ENVIRONMENT;
  if (mode !== "live" && mode !== "test") throw new Error("Payments are not configured");
  const productionProject = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("drhecmogteedejswlnpy");
  if (mode === "test" && (productionProject || process.env.VERCEL_ENV === "production")) {
    throw new Error("Test payments require a separate non-production database");
  }
  if (provider === "sandbox" && mode === "test") return sandboxProvider;
  if (provider !== "paystack") throw new Error("Unsupported payment provider");
  const key = process.env.PAYSTACK_SECRET_KEY || "";
  if (!key.startsWith(mode === "live" ? "sk_live_" : "sk_test_")) throw new Error("Payment key and environment do not match");
  return createPaystackProvider();
}

export function getPayoutProvider(): PayoutProvider {
  throw new Error("Payouts use the verified manual bank-transfer process; no automated transfer provider is enabled");
}

export function isProductionPaymentsEnabled(): boolean {
  try { return !getPaymentProvider().isSandbox; } catch { return false; }
}
