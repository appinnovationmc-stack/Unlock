import { CampaignCard } from "@/components/campaign/CampaignCard";
import { XPBadge } from "@/components/ui/XPBadge";
import { createClient } from "@/lib/supabase/server";
import type { Campaign, ImpactScore } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

function encounterKind(mechanics: string[] | null | undefined): string {
  const m = mechanics ?? [];
  if (m.includes("treasure_hunt") || m.includes("qr_scan") || m.includes("nfc_tap")) return "Hunt";
  if (m.includes("geolocation")) return "In the wild";
  if (m.includes("timed_challenge")) return "Timed drop";
  if (m.includes("social_action") || m.includes("referral")) return "Relay";
  if (m.includes("quiz") || m.includes("puzzle") || m.includes("riddle")) return "Challenge";
  return "Encounter";
}

export default async function DiscoverPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: campaigns } = await supabase.from("campaigns").select("*").eq("status", "live").order("created_at", { ascending: false });

  let mapPins: { location_id: string; campaign_id: string; campaign_title: string; label: string; lat: number; lng: number; radius_m: number }[] = [];
  try {
    const { data: pins } = await supabase.rpc("get_live_map_pins");
    mapPins = (pins as typeof mapPins) ?? [];
  } catch {
    mapPins = [];
  }

  const expByCampaign = new Map<string, string>();
  try {
    const { data: exps } = await supabase
      .from("experience_configs")
      .select("campaign_id, primary_type")
      .eq("map_visible", true);
    for (const e of exps ?? []) {
      expByCampaign.set(e.campaign_id, e.primary_type);
    }
  } catch { /* */ }
  let xp = 0;
  let impact: ImpactScore | null = null;
  if (user) {
    const { data: consumer } = await supabase.from("consumers").select("xp").eq("id", user.id).maybeSingle();
    xp = consumer?.xp ?? 0;
    const { data: score } = await supabase.from("impact_scores").select("*").eq("user_id", user.id).maybeSingle();
    impact = score as ImpactScore | null;
  }
  const list = (campaigns as Campaign[]) ?? [];
  const count = list.length;
  const positions = [
    { top: "22%", left: "18%" }, { top: "35%", left: "55%" }, { top: "58%", left: "28%" }, { top: "28%", left: "72%" },
    { top: "65%", left: "62%" }, { top: "45%", left: "40%" }, { top: "70%", left: "15%" }, { top: "18%", left: "48%" }
  ];
  return (
    <main className="min-h-screen bg-void">
      <header className="relative px-6 pt-10 pb-6 md:px-12 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-volt mb-2">UNLOCK</p>
            <h1 className="font-display text-3xl md:text-5xl text-fog tracking-tight">What&apos;s happening<br /><span className="text-mute">around you?</span></h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {user && impact ? (
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-widest text-mute">Impact</p>
                <p className="font-display text-xl text-volt">{impact.total_impact.toLocaleString()}</p>
              </div>
            ) : user ? <XPBadge xp={xp} /> : null}
            {user ? (
              <>
                <Link href="/impact" className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/30 px-3 py-1.5 hover:bg-volt/10">Impact</Link>
                <Link href="/wallet" className="font-mono text-[10px] uppercase tracking-widest text-gold border border-gold/30 px-3 py-1.5 hover:bg-gold/10">Wallet</Link>
              </>
            ) : (
              <Link href="/login" className="font-mono text-[10px] uppercase tracking-widest text-mute border border-white/10 px-3 py-1.5 hover:text-volt">Log in</Link>
            )}
          </div>
        </div>
      </header>
      <section className="relative px-6 py-8 md:px-12">
        <div className="relative aspect-[16/9] md:aspect-[21/9] max-h-[420px] w-full overflow-hidden border border-white/8 bg-ink2 clip-keyhole">
          <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(198,255,61,0.12), transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(255,61,203,0.08), transparent 45%), radial-gradient(circle at 50% 50%, rgba(11,10,20,0.9), #0B0A14)" }} />
          <div className="absolute inset-0">
            {list.slice(0, 8).map((c, i) => (
              <Link key={c.id} href={`/campaign/${c.id}`} className="absolute group" style={positions[i % positions.length]}>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt opacity-40" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-volt border border-void shadow-[0_0_12px_rgba(198,255,61,0.6)]" />
                </span>
                <span className="absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[10px] text-fog bg-void/90 border border-white/10 px-2 py-1 pointer-events-none">{c.title}</span>
              </Link>
            ))}
            {list.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-mono text-xs text-mute tracking-widest uppercase">No live pins yet</p>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt">Live map</p>
              <p className="font-display text-lg text-fog mt-0.5">{count} experience{count === 1 ? "" : "s"} near you</p>
            </div>
            <p className="font-mono text-[9px] text-mute max-w-[140px] text-right hidden sm:block">Location used only when you join a place-based challenge</p>
          </div>
        </div>
      </section>
      {!user && list.length > 0 && (
        <section className="px-6 md:px-12 pb-4">
          <div className="border border-volt/25 bg-volt/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-volt">First time?</p>
              <p className="text-fog text-sm mt-1">Open an experience. Hold to unlock. That is UNLOCK.</p>
            </div>
            <Link href={`/campaign/${list[0].id}`} className="font-mono text-[10px] uppercase tracking-widest border border-volt text-volt px-4 py-2 hover:bg-volt/10 shrink-0">
              Try one experience
            </Link>
          </div>
        </section>
      )}

      <section className="px-6 md:px-12 pb-16">
        {list.length === 0 ? (
          <div className="border border-white/5 bg-ink2/50 px-6 py-16 text-center clip-keyhole">
            <p className="font-display text-xl text-fog mb-2">The world is quiet</p>
            <p className="text-mute font-mono text-sm mb-6 max-w-md mx-auto">No live experiences right now.</p>
            <Link href="/studio" className="inline-flex font-mono text-xs uppercase tracking-widest text-volt border border-volt/40 px-4 py-2 hover:bg-volt/10">Plant an experience</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((c) => <CampaignCard key={c.id} campaign={c} kindLabel={expByCampaign.get(c.id) ?? encounterKind(c.mechanics)} />)}
          </div>
        )}
      </section>
      <footer className="px-6 pb-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-mute">Actions are value. Verified actions are higher value.</p>
      </footer>
    </main>
  );
}
