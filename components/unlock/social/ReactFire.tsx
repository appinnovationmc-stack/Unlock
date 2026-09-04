"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ReactFire({
  campaignId,
  userId,
  initialCount,
  initiallyOn
}: {
  campaignId: string;
  userId: string | null;
  initialCount: number;
  initiallyOn: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [on, setOn] = useState(initiallyOn);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    if (!userId) {
      setMsg("Log in to react.");
      return;
    }
    const supabase = createClient();
    if (on) {
      const { error } = await supabase
        .from("experience_reactions")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .eq("kind", "fire");
      if (!error) {
        setOn(false);
        setCount((n) => Math.max(0, n - 1));
      }
      return;
    }
    const { error } = await supabase.from("experience_reactions").insert({
      campaign_id: campaignId,
      user_id: userId,
      kind: "fire"
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setOn(true);
    setCount((n) => n + 1);
  }

  return (
    <div>
      <button type="button" className="unlock-glass min-h-11 px-4 text-sm" onClick={toggle}>
        {on ? "Hunting" : "Hunt this"} · {count}
      </button>
      {msg ? <p className="text-xs text-mute mt-1">{msg}</p> : null}
    </div>
  );
}
