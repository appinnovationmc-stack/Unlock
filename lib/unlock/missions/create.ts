"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMyOrgId } from "@/lib/actions/campaigns";

export async function createMission(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) return { error: "No organisation" };

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const step1 = String(formData.get("step1") ?? "").trim();
  const step1Event = String(formData.get("step1_event") ?? "CHALLENGE_COMPLETE").trim();
  const step2 = String(formData.get("step2") ?? "").trim();
  const step2Event = String(formData.get("step2_event") ?? "REWARD_UNLOCK").trim();

  if (!campaignId || !title) return { error: "Campaign and title required" };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, org_id")
    .eq("id", campaignId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!campaign) return { error: "Campaign not found" };

  const { data: mission, error } = await supabase
    .from("missions")
    .insert({
      campaign_id: campaignId,
      organisation_id: orgId,
      title,
      description,
      experience_type: "PLAY",
      sort_order: 0
    })
    .select("id")
    .single();

  if (error || !mission) return { error: error?.message ?? "Could not create mission" };

  const steps = [];
  if (step1) {
    steps.push({
      mission_id: mission.id,
      title: step1,
      required_event_type: step1Event,
      sort_order: 0
    });
  }
  if (step2) {
    steps.push({
      mission_id: mission.id,
      title: step2,
      required_event_type: step2Event,
      sort_order: 1
    });
  }
  if (steps.length) {
    await supabase.from("mission_steps").insert(steps);
  }

  revalidatePath("/studio");
  revalidatePath(`/campaign/${campaignId}`);
  revalidatePath(`/studio/live/${campaignId}`);
  return { error: null, missionId: mission.id };
}
