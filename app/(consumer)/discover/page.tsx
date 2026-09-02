import { CampaignCard } from "@/components/campaign/CampaignCard";
import { XPBadge } from "@/components/ui/XPBadge";
import { Button } from "@/components/ui/Button";
import { HonestEmpty, HonestError } from "@/components/ui/HonestState";
import { createClient } from "@/lib/supabase/server";
import type { Campaign } from "@/lib/types";
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
  const { data: campaigns, error: campaignsError } = await supabase
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
  if (user) {
    const { data: consumer } = await supabase
      .from("consumers")
      .select("xp")
      .eq("id", user.id)
      .maybeSingle();
    xp = consumer?.xp ?? 0;
  }

  const list = uniqueLiveCampaigns((campaigns as Campaign[]) ?? []);
  const count = list.length;

  return (
    <main className="min-h-screen bg-void">
      <header className="page-shell-wide pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="section-kicker mb-2">Field</p>
            <h1 className="font-display text-3xl md:text-5xl text-fog tracking-tight">
              What&apos;s <span className="text-volt">happening</span>
              <br />
              around you?
            </h1>
          </div>
          {user && xp > 0 ? <XPBadge xp={xp} /> : null}
        </div>
      </header>
      <section className="page-shell-wide py-0 pb-8">
        <div className="relative aspect-[16/9] md:aspect-[21/9] max-h-[420px] w-full min-h-[280px] overflow-hidden border border-white/8 bg-ink2">
          <div className="absolute inset-0 min-h-[280px]">
            <LiveMapSection pins={mapPins} loadError={Boolean(pinError)} />
          </div>
          <div className="absolute bottom-3 left-3 pointer-events-none z-10">
            <p className="text-sm text-fog bg-void/80 px-3 py-1.5">
              {pinError
                ? "Pins failed to load"
                : mapPins.length > 0
                  ? `${mapPins.length} pin${mapPins.length === 1 ? "" : "s"}${count > 0 ? ` · ${count} experience${count === 1 ? "" : "s"}` : ""}`
                  : count > 0
                    ? `${count} experience${count === 1 ? "" : "s"} · no live pins`
                    : "No live pins yet"}
            </p>
          </div>
        </div>
        {pinError ? (
          <div className="mt-3">
            <HonestError body="Could not load map pins. This is not an empty field." href="/discover" />
          </div>
        ) : null}
      </section>
      {!user && list.length > 0 && (
        <section className="page-shell-wide pb-8">
          <div className="border border-white/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="section-kicker">First time</p>
              <p className="text-fog text-sm mt-1">Get close. Check in. Hold to unlock.</p>
            </div>
            <Link href={`/campaign/${list[0].id}`}>
              <Button variant="volt">Try one experience</Button>
            </Link>
          </div>
        </section>
      )}

      <section className="page-shell-wide pb-16">
        {campaignsError ? (
          <HonestError body="Could not load live experiences." href="/discover" />
        ) : list.length === 0 ? (
          <HonestEmpty
            title="No live experiences"
            body="Nothing is published right now. The map stays empty until a campaign is live with a pin."
            href="/studio"
            action="Open Studio"
          />
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
    </main>
  );
}
