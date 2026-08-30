/**
 * Payment service factory.
 * Selects provider based on env. Defaults to sandbox when no live keys.
 */

import type { PaymentProvider, PayoutProvider } from "./types";
import { sandboxProvider } from "./sandbox";
import { createPaystackProvider } from "./paystack";

export * from "./types";
export { sandboxProvider } from "./sandbox";

export function getPaymentProvider(): PaymentProvider {
  const preferred = (process.env.PAYMENT_PROVIDER || "").toLowerCase();

  if (preferred === "sandbox" || process.env.NODE_ENV === "test") {
    return sandboxProvider;
  }

  if (preferred === "paystack" || process.env.PAYSTACK_SECRET_KEY) {
    try {
      return createPaystackProvider();
    } catch {
      console.warn("[payments] Paystack misconfigured — falling back to sandbox");
      return sandboxProvider;
    }
  }

  // Safe default: never pretend production money without keys
  return sandboxProvider;
}

/** Placeholder payout abstraction — implement with Paystack Transfer / Ozow / bank API later */
export function getPayoutProvider(): PayoutProvider {
  return {
    name: "sandbox-payout",
    isSandbox: true,
    async initiatePayout(params) {
      return {
        success: true,
        providerReference: `sandbox_po_${Date.now()}`,
        status: "queued"
      };
    },
    async getPayoutStatus(ref) {
      return { success: true, providerReference: ref, status: "paid" };
    }
  };
}

export function isProductionPaymentsEnabled(): boolean {
  const p = getPaymentProvider();
  return !p.isSandbox;
}
