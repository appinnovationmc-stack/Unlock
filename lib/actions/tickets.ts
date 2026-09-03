"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMyOrgId } from "@/lib/actions/campaigns";

/** Optional stock cap. unlock_campaign already stops when redeemed_count >= stock. */
export async function addCampaignReward(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Number.parseInt(stockRaw, 10);

  if (!campaignId || !label) {
    redirect(`/studio?error=${encodeURIComponent("Reward needs a name")}`);
  }
  if (stockRaw !== "" && (!Number.isFinite(stock) || (stock as number) < 1)) {
    redirect(`/studio?error=${encodeURIComponent("How many must be a whole number, or blank")}`);
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!campaign) {
    redirect(`/studio?error=${encodeURIComponent("Campaign not found")}`);
  }

  const { error } = await supabase.from("rewards").insert({
    org_id: orgId,
    campaign_id: campaignId,
    type: "discount",
    label,
    value: value || label,
    stock
  });

  if (error) {
    redirect(`/studio?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/studio");
  revalidatePath(`/campaign/${campaignId}`);
  redirect(`/studio?created=${campaignId}&reward=1`);
}
