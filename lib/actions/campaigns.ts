"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { CampaignMechanicType } from "@/lib/types";

export async function getMyOrgId() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return data?.org_id ?? null;
}

export async function createCampaign(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const title = String(formData.get("title")).trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const xp = Number(formData.get("xp_value") ?? 0);
  const mechanics = formData.getAll("mechanics") as CampaignMechanicType[];
  const rewardLabel = String(formData.get("reward_label") ?? "").trim();
  const rewardValue = String(formData.get("reward_value") ?? "").trim();

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      title,
      tagline,
      mechanics,
      xp_value: xp,
      status: "live"
    })
    .select("id")
    .single();

  if (error || !campaign) {
    return redirect(`/studio?error=${encodeURIComponent(error?.message ?? "Could not create campaign")}`);
  }

  if (rewardLabel) {
    await supabase.from("rewards").insert({
      org_id: orgId,
      campaign_id: campaign.id,
      type: "discount",
      label: rewardLabel,
      value: rewardValue || rewardLabel
    });
  }

  revalidatePath("/studio");
  revalidatePath("/discover");
  redirect("/studio");
}
