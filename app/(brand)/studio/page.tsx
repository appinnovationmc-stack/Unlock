import { Button } from "@/components/ui/Button";
import { MechanicPicker } from "@/components/campaign/MechanicPicker";
import { createCampaign, getMyOrgId } from "@/lib/actions/campaigns";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const stat = (label: string, value: string) => (
  <div className="border border-white/5 bg-ink2 px-5 py-4 clip-keyhole-sm" key={label}>
    <p className="font-mono text-[10px] uppercase tracking-widest text-mute">{label}</p>
    <p className="font-display text-2xl text-fog mt-1">{value}</p>
  </div>
);

export default async function StudioPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const { count: attributionCount } = await supabase
    .from("attribution_events")
    .select("id", { count: "exact", head: true })
    .in("campaign_id", (campaigns ?? []).map((c) => c.id));

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-magenta">{org?.name ?? "Brand"} — Studio</p>
        <h1 className="font-display text-2xl text-fog mt-1">Campaigns</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stat("Total campaigns", String(campaigns?.length ?? 0))}
        {stat("Live campaigns", String((campaigns ?? []).filter((c) => c.status === "live").length))}
        {stat("Conversions recorded", String(attributionCount ?? 0))}
        {stat("Creator earnings paid", "R0")}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h2 className="font-display text-lg text-fog mb-4">Campaign Builder</h2>
          {searchParams.error && <p className="text-sm text-magenta mb-3">{searchParams.error}</p>}
          <form action={createCampaign} className="border border-white/5 bg-ink2 p-5">
            <label className="block mb-4">
              <span className="font-mono text-xs uppercase tracking-widest text-mute">Title</span>
              <input name="title" required className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
            </label>
            <label className="block mb-4">
              <span className="font-mono text-xs uppercase tracking-widest text-mute">Tagline</span>
              <textarea name="tagline" rows={2} className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
            </label>
            <label className="block mb-4">
              <span className="font-mono text-xs uppercase tracking-widest text-mute">Mechanics</span>
              <div className="mt-2"><MechanicPicker /></div>
            </label>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">XP value</span>
                <input name="xp_value" type="number" defaultValue={100} className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
              <label className="block">
                <span className="font-mono text-xs uppercase tracking-widest text-mute">Reward value</span>
                <input name="reward_value" placeholder="20%, R150..." className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
              </label>
            </div>
            <label className="block mb-5">
              <span className="font-mono text-xs uppercase tracking-widest text-mute">Reward label</span>
              <input name="reward_label" placeholder="e.g. 20% OFF + early access" className="mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog outline-none" />
            </label>
            <Button type="submit" variant="volt" className="w-full justify-center">Publish campaign</Button>
          </form>
        </section>

        <section>
          <h2 className="font-display text-lg text-fog mb-4">Your campaigns</h2>
          <div className="border border-white/5 divide-y divide-white/5">
            {!campaigns || campaigns.length === 0 ? (
              <p className="p-5 text-mute font-mono text-sm">No campaigns yet — publish your first one.</p>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-display text-fog">{c.title}</p>
                    <p className="font-mono text-xs text-mute mt-0.5">{(c.mechanics ?? []).join(" · ")}</p>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-widest text-volt">{c.status}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
