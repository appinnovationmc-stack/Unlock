"use client";

import { useState } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

function proofCode(userId: string, campaignId: string) {
  const a = userId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const b = campaignId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `ULK-${a}${b}`;
}

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
    const code = referrerId ? proofCode(referrerId, campaignId) : null;
    const text = code ? `${title}\n${url}\n${code}` : `${title}\n${url}`;

    const canShare = typeof navigator.share === "function";
    try {
      if (canShare) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        window.prompt("Copy this drop", text);
      }
    }

    const result = await recordInteraction({
      eventType: "SHARE",
      campaignId,
      creatorId: referrerId ?? undefined,
      verificationMethod: "authenticated_session",
      metadata: { channel: canShare ? "sheet" : "copy", url, code },
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
