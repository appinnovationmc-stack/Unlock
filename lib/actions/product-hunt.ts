"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function claimProductCode(
  campaignId: string,
  code: string,
  proofPhotoUrl: string | null,
  storeLocation: string | null
) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to log in to claim this.", claimId: null, rewardLabel: null };
  }

  const { data, error } = await supabase
    .rpc("claim_product_code", {
      p_campaign_id: campaignId,
      p_code: code.trim(),
      p_proof_photo_url: proofPhotoUrl,
      p_store_location: storeLocation
    })
    .single();

  if (error) {
    return { error: error.message, claimId: null, rewardLabel: null };
  }

  const row = data as { claim_id: string; reward_label: string | null } | null;

  revalidatePath(`/campaign/${campaignId}`);

  return {
    error: null,
    claimId: row?.claim_id ?? null,
    rewardLabel: row?.reward_label ?? null
  };
}

export async function confirmProductClaim(claimId: string, campaignId: string) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to log in to confirm this.", confirmed: false };
  }

  const { data, error } = await supabase.rpc("confirm_product_claim", {
    p_claim_id: claimId
  });

  if (error) {
    return { error: error.message, confirmed: false };
  }

  revalidatePath(`/campaign/${campaignId}`);
  revalidatePath("/wallet");

  return { error: null, confirmed: Boolean(data) };
}
