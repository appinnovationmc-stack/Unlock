import { LiveCommandCentre } from "@/components/unlock/analytics/LiveCommandCentre";
import { PlayExperience } from "@/components/unlock/brand-studio/PlayExperience";
import { createClient } from "@/lib/supabase/server";
import { getMyOrgId } from "@/lib/actions/campaigns";
import { redirect, notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LiveCampaignPage({ params }: { params: { campaignId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");
  const { data: campaign } = await supabase.from("campaigns").select("id, title, status, org_id")
    .eq("id", params.campaignId).eq("org_id", orgId).maybeSingle();
  if (!campaign) notFound();

  let stats = { participating: 0, interactions: 0, store_visits: 0, product_scans: 0, rewards: 0, redemptions: 0, conversions: 0 };
  let creators: any[] = [];
  try {
    const { data: events, error } = await supabase.from("interaction_events")
      .select("event_type, verification_status, creator_id, user_id")
      .eq("campaign_id", params.campaignId).eq("verification_status", "verified");
    if (!error && events) {
      const people = new Set(events.map((e: any) => e.user_id));
      stats = {
        participating: people.size, interactions: events.length,
        store_visits: events.filter((e: any) => e.event_type === "LOCATION_CHECKIN").length,
        product_scans: events.filter((e: any) => ["QR_SCAN","PRODUCT_INTERACTION","NFC_SCAN"].includes(e.event_type)).length,
        rewards: events.filter((e: any) => ["REWARD_UNLOCK","REWARD_CLAIM"].includes(e.event_type)).length,
        redemptions: events.filter((e: any) => e.event_type === "REWARD_REDEEM").length,
        conversions: events.filter((e: any) => ["REFERRAL_CONVERSION","PURCHASE"].includes(e.event_type)).length
      };
      const byCreator = new Map<string, any>();
      for (const e of events as any[]) {
        if (!e.creator_id) continue;
        const cur = byCreator.get(e.creator_id) ?? { interactions: 0, visits: 0, conversions: 0 };
        cur.interactions += 1;
        if (e.event_type === "LOCATION_CHECKIN") cur.visits += 1;
        if (["REFERRAL_CONVERSION","PURCHASE"].includes(e.event_type)) cur.conversions += 1;
        byCreator.set(e.creator_id, cur);
      }
      const ids = Array.from(byCreator.keys());
      let handles = new Map<string, string>();
      if (ids.length) {
        const { data: rows } = await supabase.from("creators").select("id, handle").in("id", ids);
        for (const c of rows ?? []) handles.set(c.id, c.handle);
      }
      creators = Array.from(byCreator.entries()).map(([id, v]) => ({
        creator_id: id, handle: handles.get(id),
        impact: v.interactions * 10 + v.visits * 25 + v.conversions * 50,
        interactions: v.interactions, visits: v.visits, conversions: v.conversions
      })).sort((a, b) => b.impact - a.impact);
    }
  } catch { /* migration may not be applied */ }

  if (stats.interactions === 0) {
    const { count: partCount } = await supabase.from("campaign_participations").select("*", { count: "exact", head: true }).eq("campaign_id", params.campaignId);
    const { count: unlockCount } = await supabase.from("campaign_participations").select("*", { count: "exact", head: true }).eq("campaign_id", params.campaignId).not("unlocked_at", "is", null);
    const { count: claimCount } = await supabase.from("reward_claims").select("*", { count: "exact", head: true }).eq("campaign_id", params.campaignId);
    stats.participating = partCount ?? 0; stats.rewards = unlockCount ?? 0; stats.redemptions = claimCount ?? 0;
    stats.interactions = (partCount ?? 0) + (unlockCount ?? 0);
  }

  let pinCount = 0;
  let primaryType: string | null = null;
  try {
    const { count } = await supabase
      .from("campaign_locations")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", params.campaignId);
    pinCount = count ?? 0;
    const { data: exp } = await supabase
      .from("experience_configs")
      .select("primary_type")
      .eq("campaign_id", params.campaignId)
      .maybeSingle();
    primaryType = (exp as { primary_type?: string } | null)?.primary_type ?? null;
  } catch { /* */ }

  const { data: reward } = await supabase
    .from("rewards")
    .select("label, value")
    .eq("campaign_id", params.campaignId)
    .limit(1)
    .maybeSingle();
  const rewardLabel = reward
    ? `${reward.label}${reward.value ? " — " + reward.value : ""}`
    : "Demo reward";

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 bg-void space-y-12">
      <LiveCommandCentre
        campaignTitle={campaign.title}
        campaignId={campaign.id}
        status={campaign.status}
        stats={stats}
        creators={creators}
      />
      <p className="font-mono text-[10px] uppercase tracking-widest text-mute text-center">
        {primaryType ? <>Type · {primaryType} · </> : null}
        {pinCount} location pin{pinCount === 1 ? "" : "s"} ·{" "}
        <a href={`/campaign/${campaign.id}`} className="text-volt hover:underline">
          Open as consumer
        </a>
      </p>
      <section className="max-w-md mx-auto">
        <PlayExperience title={campaign.title} rewardLabel={rewardLabel} impact={50} />
      </section>
    </main>
  );
}
