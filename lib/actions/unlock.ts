"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function unlockCampaign(campaignId: string) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "You need to log in to unlock this.",
      alreadyUnlocked: false,
      xpAwarded: 0,
      rewardLabel: null as string | null
    };
  }

  const { data, error } = await supabase
    .rpc("unlock_campaign", { p_campaign_id: campaignId })
    .single();

  if (error) {
    return {
      error: error.message,
      alreadyUnlocked: false,
      xpAwarded: 0,
      rewardLabel: null as string | null
    };
  }

  const row = data as {
    xp_awarded: number;
    already_unlocked: boolean;
    reward_label: string | null;
  } | null;

  revalidatePath(`/campaign/${campaignId}`);
  revalidatePath("/discover");
  revalidatePath("/wallet");

  return {
    error: null,
    alreadyUnlocked: row?.already_unlocked ?? false,
    xpAwarded: row?.xp_awarded ?? 0,
    rewardLabel: row?.reward_label ?? null
  };
}
