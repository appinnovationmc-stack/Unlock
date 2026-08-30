/**
 * Payment provider abstraction.
 * Unlock never talks to a specific PSP from React components.
 * All provider-specific logic lives behind this interface.
 */

export type PaymentProviderName = "paystack" | "ozow" | "stripe" | "sandbox";

export type PaymentPurpose =
  | "campaign_funding"
  | "top_up"
  | "invoice_payment"
  | "subscription";

export interface CreatePaymentParams {
  amountCents: number;
  currency: string; // ISO 4217, start with ZAR
  purpose: PaymentPurpose;
  orgId: string;
  campaignId?: string;
  description?: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
  callbackUrl?: string;
  cancelUrl?: string;
}

export interface PaymentInitResult {
  success: boolean;
  paymentIntentId?: string;
  providerReference?: string;
  authorizationUrl?: string; // redirect / popup URL
  clientSecret?: string;
  error?: string;
  isSandbox?: boolean;
}

export interface PaymentStatusResult {
  status: "created" | "pending" | "processing" | "succeeded" | "failed" | "cancelled" | "refunded";
  providerReference?: string;
  amountCents?: number;
  currency?: string;
  paidAt?: string;
  failureReason?: string;
  raw?: unknown;
}

export interface RefundParams {
  providerReference: string;
  amountCents?: number; // partial allowed by some providers
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundReference?: string;
  error?: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  eventId: string;
  eventType: string;
  payload: unknown;
  error?: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  readonly isSandbox: boolean;

  createPayment(params: CreatePaymentParams): Promise<PaymentInitResult>;
  getPaymentStatus(providerReference: string): Promise<PaymentStatusResult>;
  refund(params: RefundParams): Promise<RefundResult>;
  verifyWebhook(
    rawBody: string | Buffer,
    signatureHeader: string | null,
    secret: string
  ): Promise<WebhookVerificationResult>;
}

export interface PayoutParams {
  amountCents: number;
  currency: string;
  recipientReference: string; // internal id or masked destination token
  reason?: string;
  metadata?: Record<string, string>;
}

export interface PayoutResult {
  success: boolean;
  providerReference?: string;
  status?: "queued" | "processing" | "paid" | "failed";
  error?: string;
}

export interface PayoutProvider {
  readonly name: string;
  readonly isSandbox: boolean;
  initiatePayout(params: PayoutParams): Promise<PayoutResult>;
  getPayoutStatus(providerReference: string): Promise<PayoutResult>;
}
