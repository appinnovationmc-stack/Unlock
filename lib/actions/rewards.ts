"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function prepareRedemption(claimId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_reward_redemption", { p_claim_id: claimId });
  return error ? { error: error.message } : { token: data as string };
}

export async function merchantRedeem(formData: FormData) {
  const supabase = await createClient();
  const token = String(formData.get("token") || "").trim();
  const { error } = await supabase.rpc("merchant_redeem_reward", { p_token: token });
  if (error) return { error: error.message };
  revalidatePath("/wallet");
  return { success: true };
}
