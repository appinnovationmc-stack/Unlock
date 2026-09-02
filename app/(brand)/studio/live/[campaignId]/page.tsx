import { LiveCommandCentre } from "@/components/unlock/analytics/LiveCommandCentre";
import { LiveRealtimeListener } from "@/components/unlock/analytics/LiveRealtimeListener";
import { PlayExperience } from "@/components/unlock/brand-studio/PlayExperience";
import { createClient } from "@/lib/supabase/server";
import { getMyOrgId } from "@/lib/actions/campaigns";
import { getCampaignLiveEvents } from "@/lib/actions/live";
import { redirect, notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 30;

const INTERACT_TYPES = [
  "CHALLENGE_START",
  "CHALLENGE_COMPLETE",
  "SHARE",
  "CONTENT_SUBMITTED",
  "REVIEW_SUBMITTED"
];

export default async function LiveCampaignPage({ params }: { params: { campaignId: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title, status, org_id")
    .eq("id", params.campaignId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!campaign) notFound();

  let stats = {
    participating: 0,
    interactions: 0,
    store_visits: 0,
    product_scans: 0,
    rewards: 0,
    redemptions: 0,
    conversions: 0,
    discover: 0,
    interact: 0,
    pending: 0
  };
  let creators: any[] = [];
  try {
    const { data: events, error } = await supabase
      .from("interaction_events")
      .select("event_type, verification_status, creator_id, user_id")
      .eq("campaign_id", params.campaignId)
      .eq("organisation_id", orgId);
    if (!error && events) {
      const verified = events.filter((e: any) => e.verification_status === "verified");
      const people = new Set(verified.map((e: any) => e.user_id));
      stats = {
        participating: people.size,
        interactions: verified.length,
        store_visits: verified.filter((e: any) => e.event_type === "LOCATION_CHECKIN").length,
        product_scans: verified.filter((e: any) =>
          ["QR_SCAN", "PRODUCT_INTERACTION", "NFC_SCAN"].includes(e.event_type)
        ).length,
        rewards: verified.filter((e: any) => ["REWARD_UNLOCK", "REWARD_CLAIM"].includes(e.event_type)).length,
        redemptions: verified.filter((e: any) => e.event_type === "REWARD_REDEEM").length,
        conversions: verified.filter((e: any) =>
          ["REFERRAL_CONVERSION", "PURCHASE"].includes(e.event_type)
        ).length,
        discover: verified.filter((e: any) => e.event_type === "CAMPAIGN_VIEW").length,
        interact: verified.filter((e: any) => INTERACT_TYPES.includes(e.event_type)).length,
        pending: events.filter((e: any) => e.verification_status === "pending").length
      };
      const byCreator = new Map<string, any>();
      for (const e of verified as any[]) {
        if (!e.creator_id) continue;
        const cur = byCreator.get(e.creator_id) ?? { interactions: 0, visits: 0, conversions: 0 };
        cur.interactions += 1;
        if (e.event_type === "LOCATION_CHECKIN") cur.visits += 1;
        if (["REFERRAL_CONVERSION", "PURCHASE"].includes(e.event_type)) cur.conversions += 1;
        byCreator.set(e.creator_id, cur);
      }
      const ids = Array.from(byCreator.keys());
      let handles = new Map<string, string>();
      if (ids.length) {
        const { data: rows } = await supabase.from("creators").select("id, handle").in("id", ids);
        for (const c of rows ?? []) handles.set(c.id, c.handle);
      }
      const impactByCreator = new Map<string, number>();
      let impactReady = false;
      if (ids.length) {
        const { data: impactRows, error: impactErr } = await supabase
          .from("impact_events")
          .select("creator_id, points")
          .eq("campaign_id", params.campaignId)
          .eq("organisation_id", orgId)
          .in("creator_id", ids);
        if (!impactErr) {
          impactReady = true;
          for (const row of impactRows ?? []) {
            if (!row.creator_id) continue;
            impactByCreator.set(
              row.creator_id,
              (impactByCreator.get(row.creator_id) ?? 0) + Number(row.points ?? 0)
            );
          }
        }
      }
      creators = Array.from(byCreator.entries())
        .map(([id, v]) => ({
          creator_id: id,
          handle: handles.get(id),
          impact: impactReady ? (impactByCreator.get(id) ?? 0) : null,
          interactions: v.interactions,
          visits: v.visits,
          conversions: v.conversions
        }))
        .sort((a, b) => (b.impact ?? -1) - (a.impact ?? -1));
    }
  } catch {
    /* table may not be applied */
  }

  const drilldown = await getCampaignLiveEvents(campaign.id, campaign.title, orgId);

  let locationStats: {
    location_id: string;
    label: string;
    interactions: number;
    visits: number;
    rewards: number;
    conversions: number;
  }[] = [];
  try {
    const byLoc = new Map<
      string,
      { interactions: number; visits: number; rewards: number; conversions: number }
    >();
    const { data: locEvents } = await supabase
      .from("interaction_events")
      .select("event_type, location_id")
      .eq("campaign_id", params.campaignId)
      .eq("organisation_id", orgId)
      .eq("verification_status", "verified")
      .not("location_id", "is", null);
    for (const e of locEvents ?? []) {
      if (!e.location_id) continue;
      const cur = byLoc.get(e.location_id) ?? {
        interactions: 0,
        visits: 0,
        rewards: 0,
        conversions: 0
      };
      cur.interactions += 1;
      if (e.event_type === "LOCATION_CHECKIN") cur.visits += 1;
      if (["REWARD_UNLOCK", "REWARD_CLAIM"].includes(e.event_type)) cur.rewards += 1;
      if (["REFERRAL_CONVERSION", "PURCHASE"].includes(e.event_type)) cur.conversions += 1;
      byLoc.set(e.location_id, cur);
    }
    const locIds = Array.from(byLoc.keys());
    let labels = new Map<string, string>();
    if (locIds.length) {
      const { data: locs } = await supabase
        .from("campaign_locations")
        .select("id, label")
        .eq("org_id", orgId)
        .in("id", locIds);
      for (const l of locs ?? []) labels.set(l.id, l.label);
    }
    locationStats = Array.from(byLoc.entries())
      .map(([id, v]) => ({
        location_id: id,
        label: labels.get(id) ?? id.slice(0, 8),
        ...v
      }))
      .sort((a, b) => b.interactions - a.interactions);
  } catch {
    /* */
  }

  let pinCount = 0;
  let primaryType: string | null = null;
  try {
    const { count } = await supabase
      .from("campaign_locations")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", params.campaignId)
      .eq("org_id", orgId);
    pinCount = count ?? 0;
    const { data: exp } = await supabase
      .from("experience_configs")
      .select("primary_type")
      .eq("campaign_id", params.campaignId)
      .maybeSingle();
    primaryType = (exp as { primary_type?: string } | null)?.primary_type ?? null;
  } catch {
    /* */
  }

  let spendCents: number | null = null;
  let remainingCents: number | null = null;
  try {
    const { data: budget } = await supabase
      .from("campaign_budgets")
      .select("spent_cents, total_budget_cents, reserved_cents")
      .eq("campaign_id", params.campaignId)
      .maybeSingle();
    if (budget) {
      spendCents = Number(budget.spent_cents ?? 0);
      remainingCents =
        Number(budget.total_budget_cents ?? 0) -
        Number(budget.spent_cents ?? 0) -
        Number(budget.reserved_cents ?? 0);
    }
    const { data: analytics } = await supabase
      .from("campaign_analytics")
      .select("visit_spend_cents, remaining_cents")
      .eq("campaign_id", params.campaignId)
      .maybeSingle();
    if (analytics && analytics.visit_spend_cents != null) {
      spendCents = Number(analytics.visit_spend_cents);
    }
    if (analytics && analytics.remaining_cents != null) {
      remainingCents = Number(analytics.remaining_cents);
    }
  } catch {
    /* visit_spend_cents column exists only after visit CPE SQL is applied */
  }

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
      <div className="flex justify-end">
        <LiveRealtimeListener campaignId={campaign.id} />
      </div>
      <LiveCommandCentre
        campaignTitle={campaign.title}
        campaignId={campaign.id}
        status={campaign.status}
        stats={stats}
        creators={creators}
        locations={locationStats}
        events={drilldown.events}
        truncated={drilldown.truncated}
        spendCents={spendCents}
        remainingCents={remainingCents}
      />
      <p className="text-sm text-mute text-center">
        {primaryType ? <>Type · {primaryType} · </> : null}
        {pinCount} location pin{pinCount === 1 ? "" : "s"} ·{" "}
        <a href={`/studio/live/${campaign.id}/play`} className="hover:text-fog">
          Play demo
        </a>
        {" · "}
        <a href={`/campaign/${campaign.id}`} className="hover:text-fog">
          Open as consumer
        </a>
      </p>
      <section className="max-w-md mx-auto">
        <PlayExperience title={campaign.title} rewardLabel={rewardLabel} />
      </section>
    </main>
  );
}
