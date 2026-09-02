"use client";

import { useEffect, useRef } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

/**
 * Session analytics: CAMPAIGN_VIEW once per mount.
 * Does not award conversion, CPE, visit, unlock, or Impact.
 */
export function RecordCampaignView({
  campaignId,
  creatorId
}: {
  campaignId: string;
  creatorId?: string | null;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    void recordInteraction({
      eventType: "CAMPAIGN_VIEW",
      campaignId,
      creatorId: creatorId ?? undefined,
      verificationMethod: "authenticated_session",
      metadata: { source: "campaign_page" },
      idempotencyKey: `view:${campaignId}:${new Date().toISOString().slice(0, 13)}`
    });
  }, [campaignId, creatorId]);

  return null;
}
