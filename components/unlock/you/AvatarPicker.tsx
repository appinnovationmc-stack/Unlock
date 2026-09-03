"use client";

import { useState, useTransition } from "react";
import { setConsumerAvatar } from "@/lib/actions/avatar";

export function AvatarPicker({ current }: { current?: string | null }) {
  const [preview, setPreview] = useState(current ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex items-center gap-4"
      action={(fd) => {
        start(async () => {
          const r = await setConsumerAvatar(fd);
          if (r.error) setMsg(r.error);
          else {
            setMsg("That's you on the map.");
            if (r.url) setPreview(r.url);
          }
        });
      }}
    >
      <label className="relative h-16 w-16 shrink-0 cursor-pointer">
        {preview ? (
          <img src={preview} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <img src="/unlock-mark.svg" alt="" className="h-16 w-16 rounded-full" />
        )}
        <input
          type="file"
          name="avatar"
          accept="image/jpeg,image/png,image/webp"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPreview(URL.createObjectURL(f));
          }}
        />
      </label>
      <div>
        <button type="submit" disabled={pending} className="text-sm min-h-11">
          {pending ? "Saving…" : "Use this on the map"}
        </button>
        {msg ? <p className="text-xs text-mute mt-1">{msg}</p> : (
          <p className="text-xs text-mute mt-1">Your face. Not a follower count.</p>
        )}
      </div>
    </form>
  );
}
