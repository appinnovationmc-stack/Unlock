"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ShareUnlock({
  campaignId,
  userId,
  title
}: {
  campaignId: string;
  userId: string | null;
  title: string;
}) {
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setMsg("Log in to post.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    let photo_path: string | null = null;
    let photo_url: string | null = null;
    if (file) {
      const path = `${userId}/${campaignId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "")}`;
      const { error: upErr } = await supabase.storage.from("experience-media").upload(path, file, {
        upsert: false
      });
      if (upErr) {
        setBusy(false);
        setMsg(upErr.message);
        return;
      }
      photo_path = path;
      photo_url = supabase.storage.from("experience-media").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("experience_posts").insert({
      campaign_id: campaignId,
      user_id: userId,
      caption: caption.trim() || `Unlocked ${title}`,
      photo_path,
      photo_url
    });
    setBusy(false);
    setMsg(error ? error.message : "Posted to the field.");
    if (!error) {
      setCaption("");
      setFile(null);
    }
  }

  return (
    <form onSubmit={publish} className="unlock-glass p-4 space-y-3">
      <p className="font-display text-fog">Share your unlock</p>
      <label className="block text-sm text-mute">
        Caption
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={200}
          className="mt-1 block w-full min-h-11 border border-black/10 bg-transparent px-2 text-fog"
        />
      </label>
      <label className="block text-sm text-mute">
        Photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-1 block w-full text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button type="submit" disabled={busy} className="min-h-11 px-4 text-sm border border-black/10">
        {busy ? "Posting" : "Publish"}
      </button>
      {msg ? <p className="text-sm text-mute">{msg}</p> : null}
    </form>
  );
}
