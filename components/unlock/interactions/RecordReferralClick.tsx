"use client";

import { useEffect, useRef } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

/** Session analytics for ?ref= — not a conversion and not CPE. */
export function RecordReferralClick({
  campaignId,
  creatorId
}: {
  campaignId: string;
  creatorId: string;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !creatorId) return;
    fired.current = true;
    void recordInteraction({
      eventType: "REFERRAL_CLICK",
      campaignId,
      creatorId,
      verificationMethod: "authenticated_session",
      metadata: { source: "ref_param" },
      idempotencyKey: `refclick:${campaignId}:${creatorId}:${new Date().toISOString().slice(0, 13)}`
    });
  }, [campaignId, creatorId]);
  return null;
}
