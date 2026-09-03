import Link from "next/link";
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
  const live = mapPins.length > 0;

  let youAvatar: string | null = null;
  let canPlant = false;
  if (user) {
    const { data } = await supabase
      .from("consumers")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    youAvatar = data?.avatar_url ?? null;
    const { data: member } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    canPlant = Boolean(member?.org_id);
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
        <h1 className="font-display text-3xl md:text-5xl text-fog tracking-tight">
          {live ? "Something is waiting." : "Quiet right now."}
        </h1>
        <p className="text-mute text-sm mt-3 max-w-lg">
          {live
            ? "Find it. Get close. Unlock it."
            : "The field is empty until a brand plants a moment."}
        </p>
      </header>

      <section className="page-shell-wide pb-10">
        <div className="unlock-map-frame relative w-full h-[62vh] min-h-[360px] max-h-[720px] bg-ink">
          <div className="absolute inset-0">
            <LiveMapSection pins={mapPins} youAvatar={youAvatar} />
          </div>
          {live ? (
            <div className="absolute top-3 left-3 z-10 pointer-events-none">
              <p className="text-sm text-fog unlock-glass px-3 py-1.5">
                {mapPins.length === 1 ? "One nearby" : `${mapPins.length} nearby`}
              </p>
            </div>
          ) : (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6 pointer-events-none">
              <div className="unlock-glass max-w-sm text-center px-6 py-6 pointer-events-auto">
                <p className="font-display text-xl text-fog">The city is waiting for a first drop.</p>
                <p className="text-mute text-sm mt-2">
                  Plant one pin. People walk. You measure who came.
                </p>
                {canPlant ? (
                  <Link href="/studio" className="inline-block mt-4 text-sm min-h-11 leading-[44px]">
                    Plant one
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

      {live ? (
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
      ) : null}
    </main>
  );
}
