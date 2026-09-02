"use client";

import { addCampaignLocation, removeCampaignLocation } from "@/lib/actions/campaigns";
import { Button } from "@/components/ui/Button";

type Pin = {
  id: string;
  campaign_id: string;
  label: string;
  radius_m: number;
};

export function LocationForm({
  campaigns,
  existingPins = []
}: {
  campaigns: { id: string; title: string }[];
  existingPins?: Pin[];
}) {
  if (!campaigns.length) return null;

  const field = "w-full bg-void border border-white/10 px-3 py-2 text-fog text-base outline-none";

  return (
    <div className="mt-6 space-y-4">
      {existingPins.length > 0 && (
        <div className="border border-white/10 p-4">
          <p className="section-kicker mb-3">Active pins ({existingPins.length})</p>
          <ul className="space-y-2">
            {existingPins.map((p) => {
              const camp = campaigns.find((c) => c.id === p.campaign_id);
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm border border-white/5 px-3 py-2">
                  <span className="text-fog truncate min-w-0">
                    {p.label}
                    <span className="text-mute"> · {camp?.title ?? p.campaign_id.slice(0, 8)}</span>
                    <span className="text-mute"> · {p.radius_m}m</span>
                  </span>
                  <form action={removeCampaignLocation} className="shrink-0">
                    <input type="hidden" name="location_id" value={p.id} />
                    <button type="submit" className="text-mute hover:text-fog text-sm">
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form action={addCampaignLocation} className="border border-white/10 p-5 space-y-3">
        <p className="section-kicker">Add location pin</p>
        <p className="text-mute text-sm">
          Pins power the live map and verified check-ins. Radius is metres from the point.
        </p>
        <select name="campaign_id" required className={field}>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <input name="label" required placeholder="Label (e.g. Sandton City)" className={field} />
        <div className="grid grid-cols-3 gap-2">
          <input name="lat" required type="number" step="any" placeholder="Lat" className={field} />
          <input name="lng" required type="number" step="any" placeholder="Lng" className={field} />
          <input name="radius_m" type="number" defaultValue={150} placeholder="Radius m" className={field} />
        </div>
        <Button type="submit" variant="ghost">
          Add pin
        </Button>
      </form>
    </div>
  );
}
