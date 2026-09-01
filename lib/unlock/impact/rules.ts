"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyOrgId } from "@/lib/actions/campaigns";
import { revalidatePath } from "next/cache";
import type { InteractionEventType } from "@/lib/types";

export async function upsertCampaignImpactRule(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) return { error: "No organisation" };

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "").trim() as InteractionEventType;
  const basePoints = Number(formData.get("base_points") ?? 0);
  const requiresVerified = String(formData.get("requires_verified") ?? "true") === "true";

  if (!campaignId || !eventType) return { error: "Campaign and event type required" };

  const { data: camp } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!camp) return { error: "Campaign not found" };

  const { error } = await supabase.from("impact_rules").upsert(
    {
      organisation_id: orgId,
      campaign_id: campaignId,
      event_type: eventType,
      base_points: Number.isFinite(basePoints) ? basePoints : 0,
      requires_verified: requiresVerified,
      is_active: true
    },
    { onConflict: "organisation_id,campaign_id,event_type" }
  );

  if (error) return { error: error.message };
  revalidatePath("/studio");
  revalidatePath(`/studio/live/${campaignId}`);
  return { error: null };
}
