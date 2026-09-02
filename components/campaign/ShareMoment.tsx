"use client";

import { useState } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

/**
 * Post-unlock social beat — native share or copy link.
 * Magenta/gold only when celebrated (after a win).
 */
export function ShareMoment({
  campaignId,
  title,
  rewardHint,
  celebrated = false
}: {
  campaignId: string;
  title: string;
  rewardHint?: string;
  celebrated?: boolean;
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
    let didShare = false;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: path });
        didShare = true;
      } catch {
        /* user cancelled or unsupported */
      }
    }
    if (!didShare) {
      try {
        await navigator.clipboard.writeText(`${text}\n${path}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        didShare = true;
      } catch {
        setCopied(false);
      }
    }
    if (didShare) {
      void recordInteraction({
        eventType: "SHARE",
        campaignId,
        verificationMethod: "authenticated_session",
        metadata: { source: "share_moment" },
        idempotencyKey: `share:${campaignId}:${Date.now().toString(36)}`
      });
    }
  }

  if (!celebrated) {
    return (
      <div className="border border-white/10 px-4 py-4 text-center">
        <p className="font-mono text-[10px] tracking-widest text-mute mb-2">Pass it on</p>
        <p className="text-mute text-sm mb-3">
          Share after you unlock — that is when the encounter travels.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-magenta/30 bg-magenta/5 px-4 py-4 text-center">
      <p className="font-mono text-[10px] tracking-widest text-magenta mb-2">
        Broadcast
      </p>
      <p className="text-fog text-sm mb-3">
        Experiences go viral when people pass them on — not when brands buy another
        impression.
      </p>
      <button
        type="button"
        onClick={share}
        className="font-mono text-xs tracking-widest text-void bg-volt px-4 py-2 hover:brightness-110"
      >
        {copied ? "Link copied" : "Share this encounter"}
      </button>
    </div>
  );
}
