import { Button } from "@/components/ui/Button";
import { MechanicPicker } from "@/components/campaign/MechanicPicker";
import { ExperienceBuilder } from "@/components/unlock/brand-studio/ExperienceBuilder";
import { MissionForm } from "@/components/unlock/brand-studio/MissionForm";
import { LocationForm } from "@/components/unlock/brand-studio/LocationForm";
import { createCampaign, getMyOrgId, updateCampaignStatus } from "@/lib/actions/campaigns";
import { getOrgCampaignAnalytics } from "@/lib/actions/finance";
import { formatMoney } from "@/lib/finance/money";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const OBJECTIVES = [
  "awareness", "engagement", "product_discovery", "lead_generation",
  "customer_acquisition", "store_visits", "promotions", "competitions",
  "loyalty", "product_launch", "creator_campaign"
];

const stat = (label: string, value: string) => (
  <div className="border border-white/5 bg-ink2 px-5 py-4 clip-keyhole-sm" key={label}>
    <p className="font-mono text-[10px] uppercase tracking-widest text-mute">{label}</p>
    <p className="font-display text-2xl text-fog mt-1">{value}</p>
  </div>
);

export default async function StudioPage({
  searchParams
}: {
  searchParams: { error?: string; created?: string; draft?: string };
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

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-magenta">
            {org?.name ?? "Brand"} — Studio
          </p>
          <h1 className="font-display text-3xl text-fog mt-1">Campaign Studio</h1>
          {org?.description && <p className="text-mute text-sm mt-2 max-w-xl">{org.description}</p>}
        </div>
        <p className="font-mono text-xs text-mute uppercase tracking-widest">{org?.industry ?? "general"}</p>
      </header>

      {searchParams.created === "location" && (
        <p className="mb-4 font-mono text-xs text-volt border border-volt/30 px-3 py-2">Location pin added. Check-ins will verify against its radius.</p>
      )}
      {searchParams.error && (
        <p className="mb-6 text-sm text-magenta border border-magenta/30 bg-magenta/5 px-4 py-3">{searchParams.error}</p>
      )}
      {searchParams.created && (
        <p className="mb-6 text-sm text-volt border border-volt/30 bg-volt/5 px-4 py-3">
          Campaign {searchParams.draft ? "saved as draft" : "published"} successfully.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {stat("Total campaigns", String(campaigns?.length ?? 0))}
        {stat("Live", String(liveCount))}
        {stat("Drafts", String(draftCount))}
        {stat("Unlocks", String(totals.unlocks))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stat("Unique consumers", String(totals.uniqueConsumers))}
        {stat("Reward claims", String(totals.rewardClaims))}
        {stat("Redemptions", String(totals.redemptions))}
        {stat("Creator referrals", String(totals.creatorReferrals))}
      </div>

      
      <section className="mb-12">
        <ExperienceBuilder />
      </section>

      <div className="grid lg:grid-cols-1 gap-10">

                {/* legacy form replaced by ExperienceBuilder */}


        <section>
          <h2 className="font-display text-lg text-fog mb-4">Your campaigns</h2>
          <div className="border border-white/5 divide-y divide-white/5">
            {!campaigns || campaigns.length === 0 ? (
              <p className="p-5 text-mute font-mono text-sm">No campaigns yet — create your first interactive experience.</p>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-fog">{c.title}</p>
                      <p className="font-mono text-xs text-mute mt-0.5">
                        {(c.mechanics ?? []).join(" · ") || "no mechanics"}
                        {c.objective ? ` · ${c.objective}` : ""}
                      </p>
                    </div>
                    <span className={`font-mono text-[10px] uppercase tracking-widest shrink-0 ${
                      c.status === "live" ? "text-volt" : c.status === "draft" ? "text-mute" : c.status === "paused" ? "text-gold" : "text-mute"
                    }`}>{c.status}</span>
                  </div>
                  {(() => {
                    const a: any = analyticsByCampaign.get(c.id);
                    if (!a) return null;
                    return (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-[10px] text-mute">
                        <span>Unlocks <b className="text-fog">{a.unlocks}</b></span>
                        <span>Consumers <b className="text-fog">{a.unique_consumers}</b></span>
                        <span>Claims <b className="text-fog">{a.reward_claims}</b></span>
                        <span>Redeemed <b className="text-fog">{a.redemptions}</b></span>
                        <span>Referrals <b className="text-fog">{a.creator_referrals}</b></span>
                        <span>Spent <b className="text-fog">{formatMoney(a.spent_cents)}</b></span>
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/campaign/${c.id}`} className="font-mono text-[10px] uppercase tracking-widest text-mute hover:text-volt border border-white/10 px-2 py-1">Preview</Link>
                    {(c.status === "live" || c.status === "paused") && (
                      <Link href={`/studio/live/${c.id}`} className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/40 px-2 py-1 hover:bg-volt/10">LIVE</Link>
                    )}
                    {c.status === "draft" && (
                      <form action={updateCampaignStatus}>
                        <input type="hidden" name="campaign_id" value={c.id} />
                        <input type="hidden" name="status" value="live" />
                        <button type="submit" className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/40 px-2 py-1 hover:bg-volt/10">Publish</button>
                      </form>
                    )}
                    {c.status === "live" && (
                      <form action={updateCampaignStatus}>
                        <input type="hidden" name="campaign_id" value={c.id} />
                        <input type="hidden" name="status" value="paused" />
                        <button type="submit" className="font-mono text-[10px] uppercase tracking-widest text-gold border border-gold/40 px-2 py-1 hover:bg-gold/10">Pause</button>
                      </form>
                    )}
                    {c.status === "paused" && (
                      <form action={updateCampaignStatus}>
                        <input type="hidden" name="campaign_id" value={c.id} />
                        <input type="hidden" name="status" value="live" />
                        <button type="submit" className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/40 px-2 py-1 hover:bg-volt/10">Resume</button>
                      </form>
                    )}
                    {(c.status === "live" || c.status === "paused") && (
                      <form action={updateCampaignStatus}>
                        <input type="hidden" name="campaign_id" value={c.id} />
                        <input type="hidden" name="status" value="ended" />
                        <button type="submit" className="font-mono text-[10px] uppercase tracking-widest text-mute border border-white/10 px-2 py-1 hover:text-fog">End</button>
                      </form>
                    )}
                    {c.status === "ended" && (
                      <form action={updateCampaignStatus}>
                        <input type="hidden" name="campaign_id" value={c.id} />
                        <input type="hidden" name="status" value="archived" />
                        <button type="submit" className="font-mono text-[10px] uppercase tracking-widest text-mute border border-white/10 px-2 py-1">Archive</button>
                      </form>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <MissionForm campaigns={(campaigns ?? []).map((c: any) => ({ id: c.id, title: c.title }))} />
          <LocationForm campaigns={(campaigns ?? []).map((c: any) => ({ id: c.id, title: c.title }))} existingPins={locationPins} />

          <div className="mt-8 border border-white/5 bg-ink2 p-5">
            <h3 className="font-display text-fog mb-2">Performance snapshot</h3>
            <p className="font-mono text-xs text-mute mb-3">Attribution events across your campaigns</p>
            <p className="font-display text-3xl text-fog">{totals.totalAttributionEvents}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute mt-1">
              Total recorded events · {totals.unlocks} unlocks · {formatMoney(totals.spentCents)} spent
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
