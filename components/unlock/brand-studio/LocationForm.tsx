"use client";

import { addCampaignLocation, removeCampaignLocation } from "@/lib/actions/campaigns";

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

  return (
    <div className="mt-6 space-y-4">
      {existingPins.length > 0 && (
        <div className="border border-white/8 bg-ink2/30 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-mute mb-3">
            Active pins ({existingPins.length})
          </p>
          <ul className="space-y-2">
            {existingPins.map((p) => {
              const camp = campaigns.find((c) => c.id === p.campaign_id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 font-mono text-xs border border-white/5 px-3 py-2"
                >
                  <span className="text-fog truncate min-w-0">
                    {p.label}
                    <span className="text-mute"> · {camp?.title ?? p.campaign_id.slice(0, 8)}</span>
                    <span className="text-mute"> · {p.radius_m}m</span>
                  </span>
                  <form action={removeCampaignLocation} className="shrink-0">
                    <input type="hidden" name="location_id" value={p.id} />
                    <button
                      type="submit"
                      className="text-magenta/80 hover:text-magenta uppercase tracking-widest text-[9px]"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form action={addCampaignLocation} className="border border-white/8 bg-ink2/40 p-5 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt">Add location pin</p>
        <p className="text-mute text-xs">
          Pins power the live map and verified check-ins. Radius is metres from the point.
        </p>
        <select
          name="campaign_id"
          required
          className="w-full bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <input
          name="label"
          required
          placeholder="Label (e.g. Sandton City)"
          className="w-full bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            name="lat"
            required
            type="number"
            step="any"
            placeholder="Lat"
            className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
          />
          <input
            name="lng"
            required
            type="number"
            step="any"
            placeholder="Lng"
            className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
          />
          <input
            name="radius_m"
            type="number"
            defaultValue={150}
            placeholder="Radius m"
            className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          className="font-mono text-[10px] uppercase tracking-widest border border-volt/40 text-volt px-4 py-2 hover:bg-volt/10"
        >
          Add pin
        </button>
      </form>
    </div>
  );
}
