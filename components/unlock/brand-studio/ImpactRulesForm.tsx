"use client";

import { useState, useTransition } from "react";
import { upsertCampaignImpactRule } from "@/lib/unlock/impact/rules";
import { Button } from "@/components/ui/Button";

const EVENTS = [
  "CAMPAIGN_VIEW",
  "LOCATION_CHECKIN",
  "QR_SCAN",
  "PRODUCT_INTERACTION",
  "SHARE",
  "REFERRAL_CONVERSION",
  "REWARD_UNLOCK",
  "REWARD_REDEEM",
  "CHALLENGE_COMPLETE",
  "PURCHASE"
] as const;

export function ImpactRulesForm({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!campaigns.length) return null;

  const field = "w-full bg-void border border-white/10 px-3 py-2 text-fog text-base outline-none";

  return (
    <form
      className="border border-white/10 p-5 space-y-3 mt-6"
      action={(fd) => {
        start(async () => {
          const r = await upsertCampaignImpactRule(fd);
          setMsg(r.error ? r.error : "Impact rule saved");
        });
      }}
    >
      <p className="section-kicker">Impact rules</p>
      <p className="text-mute text-sm">Override platform defaults for a campaign. Higher points = higher value actions.</p>
      <select name="campaign_id" required className={field}>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>
      <div className="grid sm:grid-cols-3 gap-2">
        <select name="event_type" className={field}>
          {EVENTS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <input name="base_points" type="number" defaultValue={25} placeholder="Points" className={field} />
        <select name="requires_verified" defaultValue="true" className={field}>
          <option value="true">Requires verified</option>
          <option value="false">Allow unverified</option>
        </select>
      </div>
      <Button type="submit" disabled={pending} variant="ghost">
        {pending ? "Saving…" : "Save rule"}
      </Button>
      {msg && <p className="text-sm text-mute">{msg}</p>}
    </form>
  );
}
