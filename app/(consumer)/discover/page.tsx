import { XPBadge } from "@/components/ui/XPBadge";
import { createClient } from "@/lib/supabase/server";
import { LiveMapSection } from "@/components/unlock/map/LiveMapSection";
import { FieldPinList } from "@/components/unlock/map/FieldPinList";
import { getLiveField } from "@/lib/unlock/field/live";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const field = await getLiveField();
  const mapPins = field.pins;

  let xp = 0;
  if (user) {
    const { data: consumer } = await supabase
      .from("consumers")
      .select("xp")
      .eq("id", user.id)
      .maybeSingle();
    xp = consumer?.xp ?? 0;
  }

  const soon = new Set(
    field.campaigns
      .filter((c) => {
        if (!c.ends_at) return false;
        const t = new Date(c.ends_at).getTime();
        return Number.isFinite(t) && t - Date.now() < 72 * 60 * 60 * 1000 && t > Date.now();
      })
      .map((c) => c.id)
  );

  return (
    <main className="min-h-screen bg-void">
      <header className="page-shell-wide pt-8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="section-kicker mb-2">Near you</p>
            <h1 className="font-display text-3xl md:text-5xl text-fog tracking-tight">
              Something is
              <br />
              <span className="text-volt">happening</span>
            </h1>
            <p className="text-mute text-sm mt-3 max-w-lg">
              Pins are places. Walk there. Hold to unlock.
            </p>
          </div>
          {user && xp > 0 ? <XPBadge xp={xp} /> : null}
        </div>
      </header>

      <section className="page-shell-wide pb-6">
        <div className="relative w-full h-[62vh] min-h-[360px] max-h-[720px] overflow-hidden bg-ink">
          <div className="absolute inset-0">
            <LiveMapSection pins={mapPins} />
          </div>
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <p className="text-sm text-fog bg-void/90 px-3 py-1.5">
              {mapPins.length > 0
                ? `${mapPins.length} ${mapPins.length === 1 ? "place" : "places"} live`
                : "The field is quiet"}
            </p>
          </div>
        </div>
      </section>

      {mapPins.length > 0 ? (
        <FieldPinList
          pins={mapPins.map((pin) => ({
            location_id: pin.location_id,
            campaign_id: pin.campaign_id,
            campaign_title: pin.campaign_title,
            label: pin.label,
            radius_m: pin.radius_m,
            endingSoon: soon.has(pin.campaign_id)
          }))}
        />
      ) : (
        <section className="page-shell-wide pb-16">
          <p className="text-mute text-base max-w-md">
            Nothing is planted on the map right now. When a brand drops a pin, it appears here.
          </p>
        </section>
      )}
    </main>
  );
}
