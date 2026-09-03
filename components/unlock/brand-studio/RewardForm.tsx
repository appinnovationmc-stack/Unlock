"use client";

import { addCampaignReward } from "@/lib/actions/tickets";
import { Button } from "@/components/ui/Button";

export function RewardForm({
  campaigns,
  defaultCampaignId
}: {
  campaigns: { id: string; title: string }[];
  defaultCampaignId?: string;
}) {
  if (!campaigns.length) return null;

  const field = "w-full bg-void border border-black/10 px-3 py-2 text-fog text-base outline-none";

  return (
    <form id="add-reward" action={addCampaignReward} className="border border-black/10 p-5 space-y-3 mt-6">
      <p className="section-kicker">What they unlock</p>
      <p className="text-mute text-sm">
        Name the prize. Optional cap — a short run. When they are gone, unlock stops.
      </p>
      <select name="campaign_id" required defaultValue={defaultCampaignId} className={field}>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <input name="label" required placeholder="Free coffee, R100 off…" className={field} />
      <input name="value" placeholder="Face value (R50, 20%…)" className={field} />
      <input
        name="stock"
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        placeholder="How many (blank = no cap)"
        className={field}
      />
      <Button type="submit" variant="ghost">
        Plant the prize
      </Button>
    </form>
  );
}
