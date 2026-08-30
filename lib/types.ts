// Core domain types — mirrors supabase schema + production completion.

export type OrgKind = "brand" | "creator_agency" | "platform";

export interface Organization {
  id: string;
  name: string;
  kind: OrgKind;
  industry: string;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  social_links: Record<string, string>;
  created_by?: string | null;
  created_at: string;
}

export type CampaignMechanicType =
  | "quiz"
  | "puzzle"
  | "riddle"
  | "treasure_hunt"
  | "qr_scan"
  | "nfc_tap"
  | "geolocation"
  | "timed_challenge"
  | "social_action"
  | "referral";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "paused"
  | "ended"
  | "archived";

export type CampaignObjective =
  | "awareness"
  | "engagement"
  | "product_discovery"
  | "lead_generation"
  | "customer_acquisition"
  | "store_visits"
  | "promotions"
  | "competitions"
  | "loyalty"
  | "product_launch"
  | "creator_campaign";

export interface Campaign {
  id: string;
  org_id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  objective: string | null;
  target_audience: string | null;
  status: CampaignStatus;
  mechanics: CampaignMechanicType[];
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  hero_image_url: string | null;
  reward_id?: string | null;
  location_ids?: string[];
  xp_value: number;
  published_at: string | null;
  paused_at: string | null;
  created_at: string;
}

export type RewardType =
  | "discount"
  | "product_unlock"
  | "prize_draw"
  | "xp_bonus"
  | "affiliate_payout";

export interface Reward {
  id: string;
  org_id: string;
  campaign_id: string;
  type: RewardType;
  label: string;
  value: string;
  stock: number | null;
  redeemed_count: number;
}

export type RewardClaimStatus =
  | "available"
  | "claimed"
  | "redeemed"
  | "expired"
  | "pending_verification";

export interface RewardClaim {
  id: string;
  reward_id: string;
  campaign_id: string;
  consumer_id: string;
  status: RewardClaimStatus;
  claimed_at: string;
  redeemed_at: string | null;
  expires_at: string | null;
  product_code_id?: string | null;
  proof_photo_url?: string | null;
  claim_store_location?: string | null;
  shared_externally?: boolean;
}

export interface ProductCode {
  id: string;
  campaign_id: string;
  code: string;
  store_location: string | null;
  status: "unclaimed" | "reserved" | "claimed";
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  org_id: string;
  name: string;
  price_cents: number | null;
  currency: string;
  hidden: boolean;
  image_url: string | null;
}

export interface CampaignLocation {
  id: string;
  org_id: string;
  campaign_id: string;
  label: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface Consumer {
  id: string;
  handle: string;
  xp: number;
  wallet_balance_cents: number;
  created_at: string;
}

export interface Creator {
  id: string;
  handle: string;
  org_id: string | null;
  audience_size: number | null;
  earnings_cents: number;
  created_at?: string;
}

export type AttributionStage =
  | "attention"
  | "engagement"
  | "physical_visit"
  | "conversion"
  | "purchase";

export interface AttributionEvent {
  id: string;
  campaign_id: string;
  consumer_id: string | null;
  creator_id: string | null;
  stage: AttributionStage;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

export interface Referral {
  id: string;
  campaign_id: string;
  referrer_consumer_id: string | null;
  referrer_creator_id: string | null;
  referred_consumer_id: string;
  converted: boolean;
}

export type AuthRole = "consumer" | "creator" | "brand" | "admin";

// ── Commercial / finance types ───────────────────────────────────────────

export type MoneyTxStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded"
  | "reversed"
  | "cancelled";

export type LedgerEntryType =
  | "brand_deposit"
  | "campaign_funding"
  | "platform_fee"
  | "creator_earning"
  | "reward_cost"
  | "refund"
  | "adjustment"
  | "withdrawal"
  | "withdrawal_fee"
  | "reversal"
  | "performance_bonus"
  | "referral_earning";

export type EarningStatus = "pending" | "available" | "paid" | "reversed" | "rejected";
export type WithdrawalStatus =
  | "requested"
  | "processing"
  | "paid"
  | "rejected"
  | "failed"
  | "cancelled";

export interface OrgFinancialAccount {
  org_id: string;
  currency: string;
  available_balance_cents: number;
  reserved_balance_cents: number;
  lifetime_deposited_cents: number;
  lifetime_spent_cents: number;
  lifetime_fees_cents: number;
  lifetime_refunds_cents: number;
  updated_at: string;
}

export interface CampaignBudget {
  campaign_id: string;
  org_id: string;
  currency: string;
  total_budget_cents: number;
  creator_allocation_cents: number;
  reward_allocation_cents: number;
  platform_fee_cents: number;
  performance_allocation_cents: number;
  spent_cents: number;
  reserved_cents: number;
  status: "active" | "exhausted" | "closed" | "refunded";
  commercial_rule_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialLedgerEntry {
  id: string;
  entry_type: LedgerEntryType;
  org_id: string | null;
  campaign_id: string | null;
  creator_id: string | null;
  consumer_id: string | null;
  amount_cents: number;
  currency: string;
  status: MoneyTxStatus;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  payment_provider: string | null;
  provider_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreatorEarning {
  id: string;
  creator_id: string;
  campaign_id: string;
  org_id: string;
  attribution_event_id: string | null;
  earning_type: string;
  amount_cents: number;
  currency: string;
  status: EarningStatus;
  verification_status: string;
  description: string;
  created_at: string;
  available_at: string | null;
  paid_at: string | null;
}

export interface CreatorWallet {
  creator_id: string;
  currency: string;
  pending_cents: number;
  available_cents: number;
  lifetime_earned_cents: number;
  lifetime_paid_cents: number;
  updated_at: string;
}

export interface CreatorWithdrawal {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  status: WithdrawalStatus;
  payout_destination_masked: string | null;
  requested_at: string;
  paid_at: string | null;
}

export interface PaymentIntent {
  id: string;
  org_id: string;
  campaign_id: string | null;
  amount_cents: number;
  currency: string;
  purpose: string;
  status: string;
  provider: string;
  provider_reference: string | null;
  idempotency_key: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  org_id: string;
  campaign_id: string | null;
  currency: string;
  subtotal_cents: number;
  platform_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
  line_items: unknown[];
}
