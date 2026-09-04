"use client";

import { useState } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

export function ShareDrop({
  campaignId,
  title,
  referrerId
}: {
  campaignId: string;
  title: string;
  referrerId?: string | null;
}) {
  const [state, setState] = useState<"idle" | "sent" | "need-login">("idle");

  async function share() {
    const path = referrerId
      ? `/campaign/${campaignId}?ref=${referrerId}`
      : `/campaign/${campaignId}`;
    const url = `${window.location.origin}${path}`;
    const text = `${title}\n${url}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copy this drop", url);
      }
    }

    const result = await recordInteraction({
      eventType: "SHARE",
      campaignId,
      creatorId: referrerId ?? undefined,
      verificationMethod: "authenticated_session",
      metadata: { channel: navigator.share ? "sheet" : "copy", url },
      idempotencyKey: `share:${campaignId}:${new Date().toISOString().slice(0, 13)}`
    });

    setState(result.error === "You need to log in." ? "need-login" : "sent");
    window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" className="unlock-glass min-h-11 px-4 text-sm text-fog" onClick={share}>
      {state === "sent"
        ? "Link sent"
        : state === "need-login"
          ? "Log in to count it"
          : "Share this drop"}
    </button>
  );
}
