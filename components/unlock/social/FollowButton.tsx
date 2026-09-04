"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FollowButton({
  me,
  them,
  initially
}: {
  me: string | null;
  them: string;
  initially: boolean;
}) {
  const [on, setOn] = useState(initially);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    if (!me) {
      setMsg("Log in to follow.");
      return;
    }
    if (me === them) return;
    const supabase = createClient();
    if (on) {
      const { error } = await supabase
        .from("user_follows")
        .delete()
        .eq("follower_id", me)
        .eq("following_id", them);
      if (!error) setOn(false);
      else setMsg(error.message);
      return;
    }
    const { error } = await supabase.from("user_follows").insert({
      follower_id: me,
      following_id: them
    });
    if (error) setMsg(error.message);
    else setOn(true);
  }

  if (me === them) return null;

  return (
    <div>
      <button type="button" className="unlock-glass min-h-11 px-4 text-sm" onClick={toggle}>
        {on ? "Following" : "Follow"}
      </button>
      {msg ? <p className="text-xs text-mute mt-1">{msg}</p> : null}
    </div>
  );
}
