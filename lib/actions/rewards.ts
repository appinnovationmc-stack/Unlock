"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function redeemClaim(claimId: string) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Log in to redeem.", ok: false };
  }

  const { error } = await supabase.rpc("redeem_reward_claim", {
    p_claim_id: claimId
  });

  if (error) {
    return { error: error.message, ok: false };
  }

  revalidatePath("/wallet");
  return { error: null, ok: true };
}
