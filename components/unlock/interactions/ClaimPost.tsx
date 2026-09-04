"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function proofCode(userId: string, campaignId: string) {
  const a = userId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const b = campaignId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `ULK-${a}${b}`;
}

export function ClaimPost({
  campaignId,
  userId
}: {
  campaignId: string;
  userId: string;
}) {
  const code = proofCode(userId, campaignId);
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("claim_social_post", {
      p_campaign_id: campaignId,
      p_post_url: url.trim(),
      p_platform: platform,
      p_proof_code: code
    });
    setBusy(false);
    setMsg(error ? error.message : "Claim in. If the link carries your code it verifies now. If not, a brand can confirm it.");
  }

  return (
    <form onSubmit={submit} className="unlock-glass p-4 space-y-3">
      <p className="font-display text-fog">Posted it?</p>
      <p className="text-mute text-sm">
        Put this code in the caption or the link, then paste the public post.
      </p>
      <p className="font-mono text-sm text-fog">{code}</p>
      <label className="block text-sm text-mute">
        Where
        <select
          className="mt-1 block w-full min-h-11 bg-transparent border border-black/10 px-2 text-fog"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="x">X</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="block text-sm text-mute">
        Public link
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          className="mt-1 block w-full min-h-11 bg-transparent border border-black/10 px-2 text-fog"
        />
      </label>
      <button type="submit" disabled={busy} className="min-h-11 px-4 text-sm text-fog border border-black/10">
        {busy ? "Sending" : "Claim this post"}
      </button>
      {msg ? <p className="text-sm text-mute">{msg}</p> : null}
    </form>
  );
}
