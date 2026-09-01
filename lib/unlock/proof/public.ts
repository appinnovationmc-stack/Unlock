import { createClient } from "@/lib/supabase/server";

/** Flagship live campaign already in production. Public reads only — never invent counts. */
export const FLAGSHIP_CAMPAIGN_ID = "ff41fd28-d93a-4494-bce6-66237a057885";

export type LockedMetric = {
  kind: "locked";
  label: string;
  reason: string;
};

export type PublicCount = {
  kind: "public";
  label: string;
  value: number;
};

export type ProofMetric = LockedMetric | PublicCount;

export type LiveMapPin = {
  location_id: string;
  campaign_id: string;
  campaign_title: string;
  label: string;
  lat: number;
  lng: number;
  radius_m: number;
};

export type PublicLiveCampaign = {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  objective: string | null;
  mechanics: string[] | null;
  xp_value: number;
  status: string;
};

export type PublicBrandProof = {
  liveCampaigns: PublicLiveCampaign[];
  liveCampaignCount: number;
  livePinCount: number;
  flagship: PublicLiveCampaign | null;
  flagshipReward: { label: string; value: string } | null;
  flagshipPins: LiveMapPin[];
  flagshipPrimaryType: string | null;
  funnel: LockedMetric[];
};

const LOCKED_FUNNEL: LockedMetric[] = [
  {
    kind: "locked",
    label: "People",
    reason: "campaign_participations is self-row or org-member only"
  },
  {
    kind: "locked",
    label: "Unlocks",
    reason: "unlocked_at aggregates are not granted to anon"
  },
  {
    kind: "locked",
    label: "Verified visits",
    reason: "interaction_events select is own-row or org-member only"
  }
];

/**
 * Public (no-login) proof payload.
 * Uses the same anon-readable surfaces as Discover: live campaigns, live rewards,
 * experience_configs, and get_live_map_pins(). Does not query Studio analytics,
 * finance, or event tables for display numbers — those would silently return 0
 * under RLS and look like fake zeros.
 */
export async function getPublicBrandProof(): Promise<PublicBrandProof> {
  const supabase = createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, tagline, description, objective, mechanics, xp_value, status")
    .eq("status", "live")
    .order("created_at", { ascending: false });

  const liveCampaigns = (campaigns as PublicLiveCampaign[] | null) ?? [];

  let pins: LiveMapPin[] = [];
  try {
    const { data } = await supabase.rpc("get_live_map_pins");
    pins = (data as LiveMapPin[] | null) ?? [];
  } catch {
    pins = [];
  }

  const flagship =
    liveCampaigns.find((c) => c.id === FLAGSHIP_CAMPAIGN_ID) ?? null;

  let flagshipReward: { label: string; value: string } | null = null;
  let flagshipPrimaryType: string | null = null;

  if (flagship) {
    const { data: reward } = await supabase
      .from("rewards")
      .select("label, value")
      .eq("campaign_id", FLAGSHIP_CAMPAIGN_ID)
      .limit(1)
      .maybeSingle();
    if (reward?.label) {
      flagshipReward = { label: reward.label, value: reward.value ?? "" };
    }

    try {
      const { data: exp } = await supabase
        .from("experience_configs")
        .select("primary_type")
        .eq("campaign_id", FLAGSHIP_CAMPAIGN_ID)
        .maybeSingle();
      flagshipPrimaryType =
        (exp as { primary_type?: string } | null)?.primary_type ?? null;
    } catch {
      flagshipPrimaryType = null;
    }
  }

  return {
    liveCampaigns,
    liveCampaignCount: liveCampaigns.length,
    livePinCount: pins.length,
    flagship,
    flagshipReward,
    flagshipPins: pins.filter((p) => p.campaign_id === FLAGSHIP_CAMPAIGN_ID),
    flagshipPrimaryType,
    funnel: LOCKED_FUNNEL
  };
}
