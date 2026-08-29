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

export type RewardClaimStatus = "available" | "claimed" | "redeemed" | "expired";

export interface RewardClaim {
  id: string;
  reward_id: string;
  campaign_id: string;
  consumer_id: string;
  status: RewardClaimStatus;
  claimed_at: string;
  redeemed_at: string | null;
  expires_at: string | null;
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
