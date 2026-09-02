"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { deliverPushToCurrentUser } from "@/lib/push/deliver";

export async function unlockCampaign(campaignId: string, referrerCreatorId?: string | null) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "You need to log in to unlock this.",
      alreadyUnlocked: false,
      xpAwarded: 0,
      impactAwarded: null as number | null,
      rewardLabel: null as string | null
    };
  }

  const args: { p_campaign_id: string; p_referrer_creator_id?: string } = {
    p_campaign_id: campaignId
  };
  if (referrerCreatorId) {
    args.p_referrer_creator_id = referrerCreatorId;
  }

  const { data, error } = await supabase.rpc("unlock_campaign", args).single();

  if (error) {
    const msg = error.message || "Could not unlock";
    const friendly = msg.includes("Check in at the place first")
      ? "Check in at the place first"
      : msg;
    return {
      error: friendly,
      alreadyUnlocked: false,
      xpAwarded: 0,
      impactAwarded: null as number | null,
      rewardLabel: null as string | null
    };
  }

  const row = data as {
    xp_awarded: number;
    already_unlocked: boolean;
    reward_label: string | null;
    impact_awarded?: number | null;
  } | null;

  revalidatePath(`/campaign/${campaignId}`);
  revalidatePath("/discover");
  revalidatePath("/wallet");
  revalidatePath("/dashboard");
  revalidatePath("/studio");

  if (row && !row.already_unlocked) {
    void deliverPushToCurrentUser({
      title: "UNLOCK",
      body: row.reward_label ? `Unlocked: ${row.reward_label}` : "Reward unlocked",
      url: `/campaign/${campaignId}`,
      tag: `unlock-${campaignId}`
    }).catch(() => undefined);
  }

  return {
    error: null,
    alreadyUnlocked: row?.already_unlocked ?? false,
    xpAwarded: row?.xp_awarded ?? 0,
    impactAwarded: typeof row?.impact_awarded === "number" ? row.impact_awarded : null,
    rewardLabel: row?.reward_label ?? null
  };
}
