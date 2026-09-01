"use client";

import { useState, useTransition } from "react";
import { upsertCampaignImpactRule } from "@/lib/unlock/impact/rules";

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

  return (
    <form
      className="border border-white/8 bg-ink2/40 p-5 space-y-3 mt-6"
      action={(fd) => {
        start(async () => {
          const r = await upsertCampaignImpactRule(fd);
          setMsg(r.error ? r.error : "Impact rule saved");
        });
      }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt">Impact rules</p>
      <p className="text-mute text-xs">Override platform defaults for a campaign. Higher points = higher value actions.</p>
      <select name="campaign_id" required className="w-full bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none">
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>
      <div className="grid sm:grid-cols-3 gap-2">
        <select name="event_type" className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none">
          {EVENTS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <input name="base_points" type="number" defaultValue={25} placeholder="Points" className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none" />
        <select name="requires_verified" defaultValue="true" className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none">
          <option value="true">Requires verified</option>
          <option value="false">Allow unverified</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="font-mono text-[10px] uppercase tracking-widest border border-volt/40 text-volt px-4 py-2 hover:bg-volt/10 disabled:opacity-50">
        {pending ? "Saving…" : "Save rule"}
      </button>
      {msg && <p className="font-mono text-xs text-mute">{msg}</p>}
    </form>
  );
}
