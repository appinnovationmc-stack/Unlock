import { CampaignCard } from "@/components/campaign/CampaignCard";
import { XPBadge } from "@/components/ui/XPBadge";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import type { Campaign } from "@/lib/types";
import Link from "next/link";
import { LiveMapSection } from "@/components/unlock/map/LiveMapSection";
import { unescapeHtmlEntities } from "@/lib/unlock/display-text";
import { getLiveField } from "@/lib/unlock/field/live";

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

/** One card per title. Prefer the copy that already has a map pin. */
function uniqueLiveCampaigns(list: Campaign[], pinnedIds: Set<string>): Campaign[] {
  const byTitle = new Map<string, Campaign>();
  for (const c of list) {
    const key = unescapeHtmlEntities(c.title).toLowerCase().trim();
    if (!key) continue;
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, c);
      continue;
    }
    if (pinnedIds.has(c.id) && !pinnedIds.has(existing.id)) {
      byTitle.set(key, c);
    }
  }
  return [...byTitle.values()];
}

export default async function DiscoverPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const field = await getLiveField();
  const mapPins = field.pins;
  const pinnedIds = new Set(mapPins.map((p) => p.campaign_id));

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

  const list = uniqueLiveCampaigns(field.campaigns, pinnedIds);
  const unpinned = list.filter((c) => !pinnedIds.has(c.id));
  const count = list.length;

  return (
    <main className="min-h-screen bg-void">
      <header className="page-shell-wide pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="section-kicker mb-2">Field</p>
            <h1 className="font-display text-3xl md:text-5xl text-fog tracking-tight">
              What&apos;s <span className="text-volt">happening</span>
              <br />
              around you?
            </h1>
            <p className="text-mute text-sm mt-3 max-w-lg">
              Pins are real places. Tap one. Get close. Check in. Hold to unlock.
            </p>
          </div>
          {user && xp > 0 ? <XPBadge xp={xp} /> : null}
        </div>
      </header>

      <section className="page-shell-wide pb-6">
        <div className="relative w-full h-[58vh] min-h-[320px] max-h-[640px] overflow-hidden border border-white/8 bg-ink2">
          <div className="absolute inset-0">
            <LiveMapSection pins={mapPins} />
          </div>
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <p className="text-sm text-fog bg-void/85 px-3 py-1.5">
              {mapPins.length > 0
                ? `${mapPins.length} live ${mapPins.length === 1 ? "place" : "places"}`
                : count > 0
                  ? "Live experiences — no pins on the map yet"
                  : "The field is quiet"}
            </p>
          </div>
        </div>
      </section>

      {mapPins.length > 0 && (
        <section className="page-shell-wide pb-10">
          <p className="section-kicker mb-3">On the field now</p>
          <ul className="divide-y divide-white/8 border border-white/8">
            {mapPins.map((pin) => (
              <li key={pin.location_id}>
                <Link
                  href={`/campaign/${pin.campaign_id}`}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-volt shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-fog truncate">
                      {unescapeHtmlEntities(pin.label || pin.campaign_title)}
                    </span>
                    <span className="block text-sm text-mute truncate">
                      {unescapeHtmlEntities(pin.campaign_title)}
                      {pin.radius_m ? ` · ${pin.radius_m}m radius` : ""}
                    </span>
                  </span>
                  <span className="text-sm text-volt shrink-0">Enter</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!user && count > 0 && (
        <section className="page-shell-wide pb-8">
          <div className="border border-white/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="section-kicker">First time</p>
              <p className="text-fog text-sm mt-1">Get close. Check in. Hold to unlock.</p>
            </div>
            <Link href={`/campaign/${mapPins[0]?.campaign_id ?? list[0].id}`}>
              <Button variant="volt">Open one nearby</Button>
            </Link>
          </div>
        </section>
      )}

      <section className="page-shell-wide pb-16">
        {count === 0 ? (
          <div className="border border-white/10 px-6 py-16 text-center">
            <p className="font-display text-xl text-fog mb-2">The field is quiet</p>
            <p className="text-mute text-base mb-6 max-w-md mx-auto">
              No live experiences right now. When a brand drops a pin, it will appear on this map.
            </p>
            <Link href="/studio">
              <Button variant="ghost">Plant an experience</Button>
            </Link>
          </div>
        ) : unpinned.length > 0 ? (
          <>
            <p className="section-kicker mb-4">
              {mapPins.length > 0 ? "Also live" : "Live experiences"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {unpinned.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  kindLabel={expByCampaign.get(c.id) ?? encounterKind(c.mechanics)}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
