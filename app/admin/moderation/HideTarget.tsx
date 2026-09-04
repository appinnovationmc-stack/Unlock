"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function HideTarget({ type, id }: { type: string; id: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  async function hide() {
    const supabase = createClient();
    const { error } = await supabase.rpc("moderate_content", {
      p_target_type: type,
      p_target_id: id,
      p_hide: true
    });
    setMsg(error ? error.message : "Hidden.");
  }

  return (
    <div className="mt-2">
      <button type="button" className="text-sm" onClick={hide}>
        Hide
      </button>
      {msg ? <p className="text-xs text-mute mt-1">{msg}</p> : null}
    </div>
  );
}
