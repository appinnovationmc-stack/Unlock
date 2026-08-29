import { Button } from "@/components/ui/Button";
import { MechanicPicker } from "@/components/campaign/MechanicPicker";
import { createCampaign, getMyOrgId, updateCampaignStatus } from "@/lib/actions/campaigns";
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

  const campaignIds = (campaigns ?? []).map((c) => c.id);

  const { count: attributionCount } = campaignIds.length
    ? await supabase.from("attribution_events").select("id", { count: "exact", head: true }).in("campaign_id", campaignIds)
    : { count: 0 };

  const { count: unlockCount } = campaignIds.length
    ? await supabase.from("attribution_events").select("id", { count: "exact", head: true }).in("campaign_id", campaignIds).eq("stage", "conversion")
    : { count: 0 };

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

      {searchParams.error && (
        <p className="mb-6 text-sm text-magenta border border-magenta/30 bg-magenta/5 px-4 py-3">{searchParams.error}</p>
      )}
      {searchParams.created && (
        <p className="mb-6 text-sm text-volt border border-volt/30 bg-volt/5 px-4 py-3">
          Campaign {searchParams.draft ? "saved as draft" : "published"} successfully.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stat("Total campaigns", String(campaigns?.length ?? 0))}
        {stat("Live", String(liveCount))}
        {stat("Drafts", String(draftCount))}
        {stat("Unlocks", String(unlockCount ?? 0))}
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        <section>
          <h2 className="font-display text-lg text-fog mb-1">Create campaign</h2>
          <p className="text-mute text-sm mb-5">Draft → publish. Title required to go live.</p>

          <form action={createCampaign} className="border border-white/5 bg-ink2 p-5 space-y-4">
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-widest text-mute">Title *</span>
              <input name="title" required placeholder="e.g. Unlock the drop"
                className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
            </label>
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-widest text-mute">Tagline</span>
              <input name="tagline" placeholder="One line that hooks participation"
                className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
            </label>
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-widest text-mute">Description</span>
              <textarea name="description" rows={3} placeholder="What should people do and why?"
                className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none resize-none" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">Objective</span>
                <select name="objective" className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none">
                  <option value="">Select…</option>
                  {OBJECTIVES.map((o) => (
                    <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">Target audience</span>
                <input name="target_audience" placeholder="e.g. 18–34 urban"
                  className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
            </div>
            <label className="block">
              <span className="font-mono text-xs uppercase tracking-widest text-mute">Mechanics</span>
              <div className="mt-2"><MechanicPicker /></div>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">Starts at</span>
                <input name="starts_at" type="datetime-local"
                  className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">Ends at</span>
                <input name="ends_at" type="datetime-local"
                  className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">XP value</span>
                <input name="xp_value" type="number" defaultValue={100} min={0}
                  className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">Hero image URL</span>
                <input name="hero_image_url" type="url" placeholder="https://…"
                  className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">Reward label</span>
                <input name="reward_label" placeholder="20% OFF + early access"
                  className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">Reward value</span>
                <input name="reward_value" placeholder="20%, R150…"
                  className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" name="status" value="draft" variant="ghost" className="flex-1 justify-center">
                Save draft
              </Button>
              <Button type="submit" name="status" value="live" variant="volt" className="flex-1 justify-center">
                Publish live
              </Button>
            </div>
          </form>
        </section>

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
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/campaign/${c.id}`} className="font-mono text-[10px] uppercase tracking-widest text-mute hover:text-volt border border-white/10 px-2 py-1">Preview</Link>
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

          <div className="mt-8 border border-white/5 bg-ink2 p-5">
            <h3 className="font-display text-fog mb-2">Performance snapshot</h3>
            <p className="font-mono text-xs text-mute mb-3">Attribution events across your campaigns</p>
            <p className="font-display text-3xl text-fog">{attributionCount ?? 0}</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute mt-1">
              Total recorded events · {unlockCount ?? 0} unlocks
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
