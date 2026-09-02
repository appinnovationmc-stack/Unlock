"use client";

import { useState, useTransition } from "react";
import { createMission } from "@/lib/unlock/missions/create";
import { Button } from "@/components/ui/Button";

export function MissionForm({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!campaigns.length) return null;

  const field = "w-full bg-void border border-white/10 px-3 py-2 text-fog text-base outline-none";

  return (
    <form
      className="border border-white/10 p-5 space-y-3 mt-8"
      action={(fd) => {
        start(async () => {
          const r = await createMission(fd);
          setMsg(r.error ? r.error : "Mission created");
        });
      }}
    >
      <p className="section-kicker">Add mission</p>
      <p className="text-mute text-sm">
        Steps wait for verified server events. Clients cannot mint unlock or conversion to complete a mission.
      </p>
      <select name="campaign_id" required className={field}>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <input name="title" required placeholder="Mission title" className={field} />
      <input name="description" placeholder="Description (optional)" className={field} />
      <div className="grid sm:grid-cols-2 gap-2">
        <input name="step1" placeholder="Step 1 title" className={field} />
        <select name="step1_event" className={field}>
          <option value="LOCATION_CHECKIN">LOCATION_CHECKIN</option>
          <option value="QR_SCAN">QR_SCAN</option>
          <option value="PRODUCT_INTERACTION">PRODUCT_INTERACTION</option>
          <option value="SHARE">SHARE</option>
        </select>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input name="step2" placeholder="Step 2 title" className={field} />
        <select name="step2_event" className={field}>
          <option value="REWARD_UNLOCK">REWARD_UNLOCK</option>
          <option value="SHARE">SHARE</option>
        </select>
      </div>
      <Button type="submit" disabled={pending} variant="ghost">
        {pending ? "Saving…" : "Create mission"}
      </Button>
      {msg && <p className="text-sm text-mute">{msg}</p>}
    </form>
  );
}
