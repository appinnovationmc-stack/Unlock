import { createClient } from "@/lib/supabase/server";
import { LiveMapSection } from "@/components/unlock/map/LiveMapSection";
import { FieldPinList } from "@/components/unlock/map/FieldPinList";
import { getLiveField } from "@/lib/unlock/field/live";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = createClient();
  await supabase.auth.getUser();
  const field = await getLiveField();
  const mapPins = field.pins;

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
        <h1 className="font-display text-3xl md:text-5xl text-fog tracking-tight">
          Something is waiting.
        </h1>
        <p className="text-mute text-sm mt-3 max-w-lg">Find it. Get close. Unlock it.</p>
      </header>

      <section className="page-shell-wide pb-6">
        <div className="unlock-map-frame relative w-full h-[62vh] min-h-[360px] max-h-[720px] overflow-hidden bg-ink">
          <div className="absolute inset-0">
            <LiveMapSection pins={mapPins} />
          </div>
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <p className="text-sm text-fog unlock-glass px-3 py-1.5">
              {mapPins.length > 0
                ? mapPins.length === 1
                  ? "One nearby"
                  : `${mapPins.length} nearby`
                : "Quiet right now"}
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
            Nothing is waiting nearby right now. When something is planted, you will see it here.
          </p>
        </section>
      )}
    </main>
  );
}
