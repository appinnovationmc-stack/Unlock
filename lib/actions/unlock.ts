"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function unlockCampaign(campaignId: string) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to log in to unlock this.", alreadyUnlocked: false };
  }

  const { data, error } = await supabase
    .rpc("unlock_campaign", { p_campaign_id: campaignId })
    .single();

  if (error) {
    return { error: error.message, alreadyUnlocked: false };
  }

  revalidatePath(`/campaign/${campaignId}`);
  revalidatePath("/discover");

  return {
    error: null,
    alreadyUnlocked: (data as { already_unlocked: boolean } | null)?.already_unlocked ?? false
  };
}
