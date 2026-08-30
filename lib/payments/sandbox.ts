/**
 * Sandbox payment provider — clearly isolated TEST mode.
 * Never pretends production money moved. All references are prefixed "sandbox_".
 */

import { randomUUID } from "crypto";
import type {
  CreatePaymentParams,
  PaymentInitResult,
  PaymentProvider,
  PaymentStatusResult,
  RefundParams,
  RefundResult,
  WebhookVerificationResult
} from "./types";

const store = new Map<
  string,
  {
    amountCents: number;
    currency: string;
    status: PaymentStatusResult["status"];
    purpose: string;
    orgId: string;
    createdAt: string;
  }
>();

export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox" as const;
  readonly isSandbox = true;

  async createPayment(params: CreatePaymentParams): Promise<PaymentInitResult> {
    if (params.amountCents <= 0) {
      return { success: false, error: "Amount must be positive", isSandbox: true };
    }

    const ref = `sandbox_${randomUUID().replace(/-/g, "")}`;
    store.set(ref, {
      amountCents: params.amountCents,
      currency: params.currency,
      status: "pending",
      purpose: params.purpose,
      orgId: params.orgId,
      createdAt: new Date().toISOString()
    });

    // Immediate "authorization" URL that a test harness can hit
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return {
      success: true,
      providerReference: ref,
      authorizationUrl: `${base}/api/payments/sandbox/complete?ref=${ref}`,
      isSandbox: true
    };
  }

  async getPaymentStatus(providerReference: string): Promise<PaymentStatusResult> {
    const row = store.get(providerReference);
    if (!row) {
      return { status: "failed", failureReason: "Unknown sandbox reference" };
    }
    return {
      status: row.status,
      providerReference,
      amountCents: row.amountCents,
      currency: row.currency,
      paidAt: row.status === "succeeded" ? new Date().toISOString() : undefined
    };
  }

  /** Test-only helper to mark a sandbox payment succeeded */
  async completeSandboxPayment(providerReference: string): Promise<PaymentStatusResult> {
    const row = store.get(providerReference);
    if (!row) {
      return { status: "failed", failureReason: "Unknown sandbox reference" };
    }
    row.status = "succeeded";
    store.set(providerReference, row);
    return this.getPaymentStatus(providerReference);
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const row = store.get(params.providerReference);
    if (!row || row.status !== "succeeded") {
      return { success: false, error: "Nothing to refund" };
    }
    row.status = "refunded";
    store.set(params.providerReference, row);
    return { success: true, refundReference: `sandbox_rf_${randomUUID().slice(0, 12)}` };
  }

  async verifyWebhook(
    rawBody: string | Buffer,
    _signatureHeader: string | null,
    _secret: string
  ): Promise<WebhookVerificationResult> {
    try {
      const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString());
      return {
        valid: true,
        eventId: payload.event_id || `sandbox_evt_${Date.now()}`,
        eventType: payload.event || "charge.success",
        payload
      };
    } catch {
      return { valid: false, eventId: "", eventType: "", payload: null, error: "Invalid JSON" };
    }
  }
}

export const sandboxProvider = new SandboxPaymentProvider();
