"use client";

import { addCampaignLocation } from "@/lib/actions/campaigns";

export function LocationForm({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  if (!campaigns.length) return null;

  return (
    <form action={addCampaignLocation} className="border border-white/8 bg-ink2/40 p-5 space-y-3 mt-6">
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
  );
}
