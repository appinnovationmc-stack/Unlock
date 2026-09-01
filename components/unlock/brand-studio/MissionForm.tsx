"use client";

import { useState, useTransition } from "react";
import { createMission } from "@/lib/unlock/missions/create";

export function MissionForm({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!campaigns.length) return null;

  return (
    <form
      className="border border-white/8 bg-ink2/40 p-5 space-y-3 mt-8"
      action={(fd) => {
        start(async () => {
          const r = await createMission(fd);
          setMsg(r.error ? r.error : "Mission created");
        });
      }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt">Add mission</p>
      <p className="text-mute text-xs">
        Optional multi-step path for a campaign. Shows on the consumer campaign page when migration is applied.
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
        name="title"
        required
        placeholder="Mission title"
        className="w-full bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
      />
      <input
        name="description"
        placeholder="Description (optional)"
        className="w-full bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
      />
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          name="step1"
          placeholder="Step 1 title"
          className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
        />
        <select name="step1_event" className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none">
          <option value="LOCATION_CHECKIN">LOCATION_CHECKIN</option>
          <option value="QR_SCAN">QR_SCAN</option>
          <option value="CHALLENGE_COMPLETE">CHALLENGE_COMPLETE</option>
          <option value="PRODUCT_INTERACTION">PRODUCT_INTERACTION</option>
          <option value="SHARE">SHARE</option>
        </select>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input
          name="step2"
          placeholder="Step 2 title"
          className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none"
        />
        <select name="step2_event" className="bg-void border border-white/10 px-3 py-2 text-fog text-sm outline-none">
          <option value="REWARD_UNLOCK">REWARD_UNLOCK</option>
          <option value="SHARE">SHARE</option>
          <option value="CHALLENGE_COMPLETE">CHALLENGE_COMPLETE</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="font-mono text-[10px] uppercase tracking-widest border border-volt/40 text-volt px-4 py-2 hover:bg-volt/10 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Create mission"}
      </button>
      {msg && <p className="font-mono text-xs text-mute">{msg}</p>}
    </form>
  );
}
