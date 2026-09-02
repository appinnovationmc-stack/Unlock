import { ExperienceBuilder } from "@/components/unlock/brand-studio/ExperienceBuilder";
import { MissionForm } from "@/components/unlock/brand-studio/MissionForm";
import { LocationForm } from "@/components/unlock/brand-studio/LocationForm";
import { RewardForm } from "@/components/unlock/brand-studio/RewardForm";
import { CampaignLaunchPath } from "@/components/unlock/brand-studio/CampaignLaunchPath";
import { ImpactRulesForm } from "@/components/unlock/brand-studio/ImpactRulesForm";
import { getMyOrgId } from "@/lib/actions/campaigns";
import { getOrgCampaignAnalytics } from "@/lib/actions/finance";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  searchParams
}: {
  searchParams: { error?: string; created?: string; draft?: string; pin?: string; reward?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const { data: org } = await supabase
    .from("organizations")
    .select("name, industry, description")
    .eq("id", orgId)
    .single();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  let locationPins: { id: string; campaign_id: string; label: string; radius_m: number }[] = [];
  try {
    const { data: locs } = await supabase
      .from("campaign_locations")
      .select("id, campaign_id, label, radius_m")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    locationPins = locs ?? [];
  } catch {
    locationPins = [];
  }

  const pinIds = new Set(locationPins.map((p) => p.campaign_id));

  let rewardByCampaign = new Set<string>();
  try {
    const { data: rewardRows } = await supabase
      .from("rewards")
      .select("campaign_id, label")
      .eq("org_id", orgId);
    for (const r of rewardRows ?? []) {
      if (r.campaign_id && String(r.label ?? "").trim()) rewardByCampaign.add(r.campaign_id);
    }
  } catch {
    rewardByCampaign = new Set();
  }

  let fundedIds = new Set<string>();
  try {
    const { data: budgetRows } = await supabase
      .from("campaign_budgets")
      .select("campaign_id")
      .eq("org_id", orgId);
    fundedIds = new Set((budgetRows ?? []).map((b) => b.campaign_id).filter(Boolean));
  } catch {
    fundedIds = new Set();
  }

  let missionRows: { id: string; title: string; campaign_id: string }[] = [];
  try {
    const { data: ms } = await supabase
      .from("missions")
      .select("id, title, campaign_id")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    missionRows = ms ?? [];
  } catch {
    missionRows = [];
  }

  const analyticsResult = await getOrgCampaignAnalytics(orgId);
  const analyticsRows: any[] =
    "analytics" in analyticsResult && analyticsResult.analytics ? analyticsResult.analytics : [];
  const analyticsByCampaign = new Map(analyticsRows.map((a: any) => [a.campaign_id, a]));

  const totals = analyticsRows.reduce(
    (acc: any, a: any) => ({
      unlocks: acc.unlocks + (a.unlocks ?? 0),
      uniqueConsumers: acc.uniqueConsumers + (a.unique_consumers ?? 0),
      rewardClaims: acc.rewardClaims + (a.reward_claims ?? 0),
      redemptions: acc.redemptions + (a.redemptions ?? 0),
      creatorReferrals: acc.creatorReferrals + (a.creator_referrals ?? 0),
      spentCents: acc.spentCents + (a.spent_cents ?? 0),
      totalAttributionEvents: acc.totalAttributionEvents + (a.total_attribution_events ?? 0)
    }),
    {
      unlocks: 0,
      uniqueConsumers: 0,
      rewardClaims: 0,
      redemptions: 0,
      creatorReferrals: 0,
      spentCents: 0,
      totalAttributionEvents: 0
    }
  );

  const liveCount = (campaigns ?? []).filter((c) => c.status === "live").length;
  const draftCount = (campaigns ?? []).filter((c) => c.status === "draft").length;
  const hasCampaigns = (campaigns?.length ?? 0) > 0;
  const createdId =
    searchParams.created && searchParams.created !== "location" && searchParams.created !== "location_removed"
      ? searchParams.created
      : undefined;
  const campaignOptions = (campaigns ?? []).map((c: any) => ({ id: c.id, title: c.title }));
  const missingReward = campaignOptions.filter((c) => !rewardByCampaign.has(c.id));

  return (
    <main className="page-shell-wide min-h-screen">
      <header className="mb-10">
        <p className="section-kicker">{org?.name ?? "Brand"}</p>
        <h1 className="font-display text-3xl text-fog mt-1">
          Campaign <span className="text-volt">Studio</span>
        </h1>
        {org?.description && <p className="text-mute text-base mt-2 max-w-xl">{org.description}</p>}
        {hasCampaigns && (
          <p className="text-sm text-mute mt-3">
            {liveCount} live · {draftCount} drafts
            {totals.unlocks > 0 ? ` · ${totals.unlocks} unlocks` : ""}
          </p>
        )}
      </header>

      {searchParams.pin === "1" && (
        <p className="mb-4 text-sm text-fog border border-white/15 px-3 py-2">
          Location pin added. Next: name the reward if it is missing, fund, then publish.
        </p>
      )}
      {searchParams.reward === "1" && (
        <p className="mb-4 text-sm text-fog border border-white/15 px-3 py-2">
          Reward saved. Next: fund a budget, preview, then publish.
        </p>
      )}
      {searchParams.created === "location" && (
        <p className="mb-4 text-sm text-fog border border-white/15 px-3 py-2">Location pin added. Check-ins will verify against its radius.</p>
      )}
      {searchParams.error && (
        <p className="mb-6 text-sm text-magenta border border-magenta/30 px-4 py-3">{searchParams.error}</p>
      )}
      {searchParams.created && searchParams.draft && !searchParams.error && (
        <p className="mb-6 text-sm text-fog border border-white/15 px-4 py-3">
          Draft saved. It is not live. Next: add a pin, add a reward, fund, preview, then publish.
        </p>
      )}
      {searchParams.created && !searchParams.draft && searchParams.created !== "location" && searchParams.created !== "location_removed" && !searchParams.pin && !searchParams.reward && (
        <p className="mb-6 text-sm text-fog border border-white/15 px-4 py-3">
          Campaign published successfully.
        </p>
      )}

      <section className="mb-12">
        <ExperienceBuilder />
      </section>

      <section>
        <h2 className="font-display text-lg text-fog mb-4">Your campaigns</h2>
        <div className="border border-white/10 divide-y divide-white/10">
          {!hasCampaigns ? (
            <div className="px-5 py-12">
              <p className="font-display text-xl text-fog">No campaigns yet</p>
              <p className="text-mute text-base mt-2 max-w-md">
                Build an experience above. Nothing is live until you publish. Counts stay empty until people actually show up.
              </p>
            </div>
          ) : (
            campaigns!.map((c) => (
              <div
                key={c.id}
                id={`campaign-${c.id}`}
                className={`px-5 py-5 space-y-3 ${
                  createdId === c.id ? "bg-white/[0.03]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-fog text-lg">{c.title}</p>
                    <p className="text-sm text-mute mt-1">
                      {(c.objective ? String(c.objective).replace(/_/g, " ") : "experience")}
                      {c.tagline ? ` · ${c.tagline}` : ""}
                    </p>
                  </div>
                  <span className={`text-sm shrink-0 ${
                    c.status === "live" ? "text-volt" : "text-mute"
                  }`}>{c.status}</span>
                </div>
                {(() => {
                  const a: any = analyticsByCampaign.get(c.id);
                  if (!a) return null;
                  const parts = [
                    a.unlocks ? `${a.unlocks} unlocks` : null,
                    a.unique_consumers ? `${a.unique_consumers} people` : null,
                    a.reward_claims ? `${a.reward_claims} claims` : null,
                    a.redemptions ? `${a.redemptions} redeemed` : null,
                    a.creator_referrals ? `${a.creator_referrals} referrals` : null,
                    a.spent_cents ? formatMoney(a.spent_cents) : null
                  ].filter(Boolean);
                  if (typeof a.verified_visits === "number" && a.verified_visits > 0) {
                    parts.push(
                      `${a.verified_visits} verified visits` +
                        (typeof a.visit_spend_cents === "number" ? ` · visit CPE ${formatMoney(a.visit_spend_cents)}` : "")
                    );
                  }
                  if (!parts.length) return null;
                  return <p className="text-sm text-mute">{parts.join(" · ")}</p>;
                })()}
                <CampaignLaunchPath
                  campaign={{
                    id: c.id,
                    status: c.status,
                    hasPin: pinIds.has(c.id),
                    hasReward: rewardByCampaign.has(c.id),
                    hasBudget: fundedIds.has(c.id)
                  }}
                />
              </div>
            ))
          )}
        </div>

        {missionRows.length > 0 && (
          <div className="mt-8 border border-white/10 p-4">
            <p className="section-kicker mb-3">Missions ({missionRows.length})</p>
            <ul className="space-y-2">
              {missionRows.map((m) => {
                const camp = (campaigns ?? []).find((c: any) => c.id === m.campaign_id);
                return (
                  <li key={m.id} className="text-sm flex justify-between border border-white/5 px-3 py-2">
                    <span className="text-fog">{m.title}</span>
                    <span className="text-mute">{camp?.title ?? m.campaign_id.slice(0, 8)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <MissionForm campaigns={campaignOptions} />
        <LocationForm campaigns={campaignOptions} existingPins={locationPins} defaultCampaignId={createdId} />
        {missingReward.length > 0 && (
          <RewardForm campaigns={missingReward} defaultCampaignId={createdId} />
        )}
        <ImpactRulesForm campaigns={campaignOptions} />

        {totals.totalAttributionEvents > 0 && (
          <div className="mt-8 border border-white/10 p-5">
            <h3 className="font-display text-fog mb-2">Performance</h3>
            <p className="text-sm text-mute mb-3">Recorded events across your campaigns</p>
            <p className="font-display text-3xl text-fog">{totals.totalAttributionEvents}</p>
            <p className="text-sm text-mute mt-1">
              {totals.unlocks} unlocks · {formatMoney(totals.spentCents)} spent
            </p>
            <p className="text-sm text-mute mt-2">
              Visit campaigns bill verified store check-ins (CPE). Unlock and XP do not spend brand money.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
