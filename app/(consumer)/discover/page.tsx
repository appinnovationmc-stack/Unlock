import { CampaignCard } from "@/components/campaign/CampaignCard";
import { XPBadge } from "@/components/ui/XPBadge";
import { createClient } from "@/lib/supabase/server";
import type { Campaign, ImpactScore } from "@/lib/types";
import Link from "next/link";
import { LiveMapSection } from "@/components/unlock/map/LiveMapSection";
import { unescapeHtmlEntities } from "@/lib/unlock/display-text";
import type { MapPin } from "@/components/unlock/map/LiveMap";

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

/** Hide duplicate live rows that share the same title + copy (e.g. two "find taboo" cards). */
function uniqueLiveCampaigns(list: Campaign[]): Campaign[] {
  const seen = new Set<string>();
  const out: Campaign[] = [];
  for (const c of list) {
    const title = unescapeHtmlEntities(c.title).toLowerCase();
    const copy = unescapeHtmlEntities(c.tagline || c.description).toLowerCase();
    const key = `${title}|${copy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export default async function DiscoverPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "live")
    .order("created_at", { ascending: false });

  let mapPins: MapPin[] = [];
  const { data: pins, error: pinError } = await supabase.rpc("get_live_map_pins");
  if (!pinError && Array.isArray(pins)) {
    mapPins = pins as MapPin[];
  }

  const expByCampaign = new Map<string, string>();
  const { data: exps } = await supabase
    .from("experience_configs")
    .select("campaign_id, primary_type")
    .eq("map_visible", true);
  for (const e of exps ?? []) {
    expByCampaign.set(e.campaign_id, e.primary_type);
  }

  let xp = 0;
  let impact: ImpactScore | null = null;
  if (user) {
    const { data: consumer } = await supabase
      .from("consumers")
      .select("xp")
      .eq("id", user.id)
      .maybeSingle();
    xp = consumer?.xp ?? 0;
    const { data: score } = await supabase
      .from("impact_scores")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    impact = score as ImpactScore | null;
  }

  const list = uniqueLiveCampaigns((campaigns as Campaign[]) ?? []);
  const count = list.length;

  return (
    <main className="min-h-screen bg-void">
      <header className="relative px-6 pt-10 pb-6 md:px-12 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-volt mb-2">UNLOCK</p>
            <h1 className="font-display text-3xl md:text-5xl text-fog tracking-tight">
              What&apos;s happening
              <br />
              <span className="text-mute">around you?</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {user && impact ? (
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-widest text-mute">Impact</p>
                <p className="font-display text-xl text-volt">{impact.total_impact.toLocaleString()}</p>
              </div>
            ) : user ? (
              <XPBadge xp={xp} />
            ) : null}
            {user ? (
              <>
                <Link
                  href="/impact"
                  className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/30 px-3 py-1.5 hover:bg-volt/10"
                >
                  Impact
                </Link>
                <Link
                  href="/wallet"
                  className="font-mono text-[10px] uppercase tracking-widest text-gold border border-gold/30 px-3 py-1.5 hover:bg-gold/10"
                >
                  Wallet
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="font-mono text-[10px] uppercase tracking-widest text-mute border border-white/10 px-3 py-1.5 hover:text-volt"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>
      <section className="relative px-6 py-8 md:px-12">
        <div className="relative aspect-[16/9] md:aspect-[21/9] max-h-[420px] w-full min-h-[280px] overflow-hidden border border-white/8 bg-ink2 clip-keyhole">
          <div className="absolute inset-0 min-h-[280px]">
            <LiveMapSection pins={mapPins} />
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none z-10">
            <div className="bg-void/80 border border-white/10 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt">Live map</p>
              <p className="font-display text-lg text-fog mt-0.5">
                {mapPins.length > 0
                  ? `${mapPins.length} pin${mapPins.length === 1 ? "" : "s"} · ${count} experience${count === 1 ? "" : "s"}`
                  : `${count} experience${count === 1 ? "" : "s"} · Johannesburg`}
              </p>
            </div>
            <p className="font-mono text-[9px] text-mute max-w-[140px] text-right hidden sm:block bg-void/80 border border-white/10 px-2 py-1">
              Location used only when you join a place-based challenge
            </p>
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
            <Link
              href={`/campaign/${list[0].id}`}
              className="font-mono text-[10px] uppercase tracking-widest border border-volt text-volt px-4 py-2 hover:bg-volt/10 shrink-0"
            >
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
            <Link
              href="/studio"
              className="inline-flex font-mono text-xs uppercase tracking-widest text-volt border border-volt/40 px-4 py-2 hover:bg-volt/10"
            >
              Plant an experience
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                kindLabel={expByCampaign.get(c.id) ?? encounterKind(c.mechanics)}
              />
            ))}
          </div>
        )}
      </section>
      <footer className="px-6 pb-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-mute">
          Actions are value. Verified actions are higher value.
        </p>
      </footer>
    </main>
  );
}
