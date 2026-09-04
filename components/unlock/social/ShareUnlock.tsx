"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 8 * 1024 * 1024;

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
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(next: File | null) {
    setMsg(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ALLOWED.has(next.type) && !next.type.startsWith("image/")) {
      setMsg("Use a photo (JPG, PNG, or WebP).");
      return;
    }
    if (next.size > MAX_BYTES) {
      setMsg("Photo must be under 8 MB.");
      return;
    }
    setFile(next);
  }

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
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${campaignId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("experience-media").upload(path, file, {
        upsert: false,
        contentType: file.type || "image/jpeg"
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
      <p className="section-kicker">Share your unlock</p>
      <p className="font-display text-fog">You found it. Show it.</p>
      {preview ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="w-full max-h-64 object-cover" />
          <button type="button" className="text-sm text-mute" onClick={() => pick(null)}>
            Retake
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <label className="unlock-glass min-h-11 px-4 inline-flex items-center text-sm cursor-pointer">
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="unlock-glass min-h-11 px-4 inline-flex items-center text-sm cursor-pointer">
            Choose photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}
      <label className="block text-sm text-mute">
        Caption
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={200}
          placeholder="I just unlocked this."
          className="mt-1 block w-full min-h-11 border border-black/10 bg-transparent px-2 text-fog"
        />
      </label>
      <button type="submit" disabled={busy} className="min-h-11 px-4 text-sm border border-black/10">
        {busy ? "Posting" : "Share your unlock"}
      </button>
      {msg ? <p className="text-sm text-mute">{msg}</p> : null}
    </form>
  );
}
