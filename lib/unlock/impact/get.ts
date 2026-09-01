"use server";
import { createClient } from "@/lib/supabase/server";
import type { ImpactScore } from "@/lib/types";

export async function getUserImpact(userId?: string): Promise<ImpactScore | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const target = userId ?? user?.id;
  if (!target) return null;
  const { data } = await supabase.from("impact_scores").select("*").eq("user_id", target).maybeSingle();
  if (data) return data as ImpactScore;
  return { user_id: target, total_impact: 0, verified_interactions: 0, store_visits: 0, conversions: 0, last_updated_at: new Date().toISOString() };
}

export async function getImpactLeaderboard(limit = 20) {
  const supabase = createClient();
  const { data } = await supabase.from("impact_scores")
    .select("user_id, total_impact, verified_interactions, store_visits, conversions")
    .order("total_impact", { ascending: false }).limit(limit);
  return data ?? [];
}
