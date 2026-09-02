"use client";

import { addCampaignReward } from "@/lib/actions/campaigns";
import { Button } from "@/components/ui/Button";

export function RewardForm({
  campaigns,
  defaultCampaignId
}: {
  campaigns: { id: string; title: string }[];
  defaultCampaignId?: string;
}) {
  if (!campaigns.length) return null;

  const field = "w-full bg-void border border-white/10 px-3 py-2 text-fog text-base outline-none";

  return (
    <form id="add-reward" action={addCampaignReward} className="border border-white/10 p-5 space-y-3 mt-6">
      <p className="section-kicker">Add a reward</p>
      <p className="text-mute text-sm">
        Name what people unlock. A draft cannot go live without a reward.
      </p>
      <select name="campaign_id" required defaultValue={defaultCampaignId} className={field}>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <input name="label" required placeholder="Reward name (e.g. 20% off first visit)" className={field} />
      <input name="value" placeholder="Value (R50, 20%…)" className={field} />
      <Button type="submit" variant="ghost">
        Add reward
      </Button>
    </form>
  );
}
