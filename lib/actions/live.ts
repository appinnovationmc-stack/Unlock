"use server";

import { getMyOrgId } from "@/lib/actions/campaigns";
import { createClient } from "@/lib/supabase/server";
import type { InteractionEventType, VerificationStatus } from "@/lib/types";

const LIVE_EVENT_LIMIT = 250;

export type LiveDrilldownEvent = {
  id: string;
  campaign_id: string;
  campaign_title: string;
  event_type: InteractionEventType;
  created_at: string;
  verification_status: VerificationStatus;
  verification_method: string | null;
  location_id: string | null;
  location_label: string | null;
  creator_id: string | null;
  creator_label: string | null;
  impact_points: number | null;
  user_id: string;
  risk_score: number | null;
  risk_reasons: string[];
};

export type LiveDrilldown = {
  events: LiveDrilldownEvent[];
  truncated: boolean;
  loaded: number;
  error: string | null;
};

function metadataRisk(meta: unknown): { score: number | null; reasons: string[] } {
  if (!meta || typeof meta !== "object") return { score: null, reasons: [] };
  const rec = meta as Record<string, unknown>;
  const raw = rec.risk_score;
  const score =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.max(0, Math.min(100, Math.round(raw)))
      : typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))
        ? Math.max(0, Math.min(100, Math.round(Number(raw))))
        : null;
  const reasons = Array.isArray(rec.risk_reasons)
    ? rec.risk_reasons.filter((r): r is string => typeof r === "string" && r.length > 0)
    : [];
  return { score, reasons };
}

/** Org-member RLS read of interaction_events. No SECURITY DEFINER. */
export async function getCampaignLiveEvents(
  campaignId: string,
  campaignTitle: string,
  orgId: string
): Promise<LiveDrilldown> {
  const empty: LiveDrilldown = { events: [], truncated: false, loaded: 0, error: null };
  const myOrg = await getMyOrgId();
  if (!myOrg || myOrg !== orgId) {
    return { ...empty, error: "Could not load events for this organisation." };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("interaction_events")
    .select(
      "id, user_id, campaign_id, organisation_id, creator_id, location_id, event_type, verification_method, verification_status, created_at, metadata"
    )
    .eq("campaign_id", campaignId)
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false })
    .limit(LIVE_EVENT_LIMIT + 1);

  if (error || !data) {
    return { ...empty, error: error?.message || "Could not load events." };
  }

  const truncated = data.length > LIVE_EVENT_LIMIT;
  const rows = truncated ? data.slice(0, LIVE_EVENT_LIMIT) : data;

  const locIds = Array.from(
    new Set(rows.map((r) => r.location_id).filter((id): id is string => Boolean(id)))
  );
  const creatorIds = Array.from(
    new Set(rows.map((r) => r.creator_id).filter((id): id is string => Boolean(id)))
  );
  const eventIds = rows.map((r) => r.id);

  const [locsRes, creatorsRes, impactRes] = await Promise.all([
    locIds.length
      ? supabase.from("campaign_locations").select("id, label").eq("org_id", orgId).in("id", locIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    creatorIds.length
      ? supabase.from("creators").select("id, handle").in("id", creatorIds)
      : Promise.resolve({ data: [] as { id: string; handle: string }[] }),
    eventIds.length
      ? supabase
          .from("impact_events")
          .select("interaction_event_id, points")
          .eq("campaign_id", campaignId)
          .eq("organisation_id", orgId)
          .in("interaction_event_id", eventIds)
      : Promise.resolve({ data: [] as { interaction_event_id: string; points: number }[] })
  ]);

  const labels = new Map((locsRes.data ?? []).map((l) => [l.id, l.label]));
  const handles = new Map((creatorsRes.data ?? []).map((c) => [c.id, c.handle]));
  const impactByEvent = new Map<string, number>();
  for (const row of impactRes.data ?? []) {
    if (!row.interaction_event_id) continue;
    impactByEvent.set(
      row.interaction_event_id,
      (impactByEvent.get(row.interaction_event_id) ?? 0) + Number(row.points ?? 0)
    );
  }

  const events: LiveDrilldownEvent[] = rows.map((r) => {
    const risk = metadataRisk((r as { metadata?: unknown }).metadata);
    return {
      id: r.id,
      campaign_id: r.campaign_id,
      campaign_title: campaignTitle,
      event_type: r.event_type,
      created_at: r.created_at,
      verification_status: r.verification_status,
      verification_method: r.verification_method ?? null,
      location_id: r.location_id,
      location_label: r.location_id ? labels.get(r.location_id) ?? r.location_id.slice(0, 8) : null,
      creator_id: r.creator_id,
      creator_label: r.creator_id
        ? handles.get(r.creator_id) ?? r.creator_id.slice(0, 8)
        : null,
      impact_points: impactByEvent.has(r.id) ? impactByEvent.get(r.id)! : null,
      user_id: r.user_id,
      risk_score: risk.score,
      risk_reasons: risk.reasons
    };
  });

  return { events, truncated, loaded: events.length, error: null };
}
