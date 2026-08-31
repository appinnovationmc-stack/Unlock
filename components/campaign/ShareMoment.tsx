"use client";

import { useState } from "react";

/**
 * Post-unlock social beat — native share or copy link.
 * Designed as the "broadcast" step after the encounter.
 */
export function ShareMoment({
  campaignId,
  title,
  rewardHint
}: {
  campaignId: string;
  title: string;
  rewardHint?: string;
}) {
  const [copied, setCopied] = useState(false);

  const path =
    typeof window !== "undefined"
      ? `${window.location.origin}/campaign/${campaignId}`
      : `/campaign/${campaignId}`;

  const text = rewardHint
    ? `I just unlocked “${title}” — ${rewardHint}. Don't just see the ad. Unlock it.`
    : `I just unlocked “${title}”. Don't just see the ad. Unlock it.`;

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: path });
        return;
      } catch {
        /* user cancelled or unsupported */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="border border-magenta/30 bg-magenta/5 px-4 py-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-magenta mb-2">
        Broadcast
      </p>
      <p className="text-fog text-sm mb-3">
        Experiences go viral when people pass them on — not when brands buy another
        impression.
      </p>
      <button
        type="button"
        onClick={share}
        className="font-mono text-xs uppercase tracking-widest text-void bg-volt px-4 py-2 hover:brightness-110"
      >
        {copied ? "Link copied" : "Share this encounter"}
      </button>
    </div>
  );
}
