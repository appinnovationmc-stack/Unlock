"use client";

import { useState } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";
import { Button } from "@/components/ui/Button";

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

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text}\n${path}`)}`;

  async function share() {
    let didShare = false;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: path });
        didShare = true;
      } catch {
        /* cancelled */
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
    return null;
  }

  return (
    <div className="border border-magenta/30 bg-magenta/5 px-4 py-4 text-center space-y-3">
      <p className="text-xs text-volt">Share</p>
      <p className="text-fog text-sm">Pass this encounter on.</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <a href={waHref} target="_blank" rel="noopener noreferrer">
          <Button variant="volt">WhatsApp</Button>
        </a>
        <Button type="button" variant="ghost" onClick={share}>
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
