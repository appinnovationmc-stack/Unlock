/**
 * Paystack provider — primary for South African launch.
 * Supports cards, EFT, Instant EFT, and local methods.
 * Credentials must come from env; never hardcode secrets.
 *
 * Env:
 *   PAYSTACK_SECRET_KEY
 *   PAYSTACK_PUBLIC_KEY (client if needed)
 *   PAYSTACK_WEBHOOK_SECRET
 *   PAYSTACK_MODE = live | test
 */

import crypto from "crypto";
import type {
  CreatePaymentParams,
  PaymentInitResult,
  PaymentProvider,
  PaymentStatusResult,
  RefundParams,
  RefundResult,
  WebhookVerificationResult
} from "./types";

const PAYSTACK_BASE = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  return key;
}

function isTestMode(): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY || "";
  return key.startsWith("sk_test_") || process.env.PAYSTACK_MODE === "test";
}

async function paystackFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await res.json();
  if (!res.ok || body.status === false) {
    const msg = body.message || `Paystack error ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = "paystack" as const;

  get isSandbox(): boolean {
    return isTestMode();
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentInitResult> {
    try {
      // Paystack expects amount in the smallest currency unit (kobo/cents)
      const body = {
        amount: params.amountCents,
        currency: params.currency.toUpperCase(),
        email: params.customerEmail || "billing@unlock.app",
        reference: params.idempotencyKey,
        callback_url: params.callbackUrl,
        metadata: {
          org_id: params.orgId,
          campaign_id: params.campaignId || null,
          purpose: params.purpose,
          ...params.metadata
        }
      };

      const data = await paystackFetch("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify(body)
      });

      return {
        success: true,
        providerReference: data.data.reference,
        authorizationUrl: data.data.authorization_url,
        clientSecret: data.data.access_code,
        isSandbox: this.isSandbox
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Paystack init failed",
        isSandbox: this.isSandbox
      };
    }
  }

  async getPaymentStatus(providerReference: string): Promise<PaymentStatusResult> {
    try {
      const data = await paystackFetch(`/transaction/verify/${encodeURIComponent(providerReference)}`);
      const tx = data.data;
      const statusMap: Record<string, PaymentStatusResult["status"]> = {
        success: "succeeded",
        failed: "failed",
        abandoned: "cancelled",
        reversed: "refunded"
      };
      return {
        status: statusMap[tx.status] || "pending",
        providerReference: tx.reference,
        amountCents: tx.amount,
        currency: tx.currency,
        paidAt: tx.paid_at || undefined,
        failureReason: tx.gateway_response,
        raw: tx
      };
    } catch (err) {
      return {
        status: "failed",
        failureReason: err instanceof Error ? err.message : "Verify failed"
      };
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const body: Record<string, unknown> = {
        transaction: params.providerReference
      };
      if (params.amountCents != null) body.amount = params.amountCents;
      if (params.reason) body.merchant_note = params.reason;

      const data = await paystackFetch("/refund", {
        method: "POST",
        body: JSON.stringify(body)
      });

      return {
        success: true,
        refundReference: String(data.data.id || data.data.transaction?.reference)
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Refund failed"
      };
    }
  }

  async verifyWebhook(
    rawBody: string | Buffer,
    signatureHeader: string | null,
    secret: string
  ): Promise<WebhookVerificationResult> {
    if (!signatureHeader) {
      return { valid: false, eventId: "", eventType: "", payload: null, error: "Missing signature" };
    }

    const hash = crypto
      .createHmac("sha512", secret)
      .update(typeof rawBody === "string" ? rawBody : rawBody)
      .digest("hex");

    if (hash !== signatureHeader) {
      return { valid: false, eventId: "", eventType: "", payload: null, error: "Invalid signature" };
    }

    try {
      const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString());
      return {
        valid: true,
        eventId: payload.data?.id?.toString() || payload.data?.reference || `ps_${Date.now()}`,
        eventType: payload.event || "unknown",
        payload
      };
    } catch {
      return { valid: false, eventId: "", eventType: "", payload: null, error: "Invalid JSON body" };
    }
  }
}

export function createPaystackProvider(): PaystackPaymentProvider {
  return new PaystackPaymentProvider();
}
