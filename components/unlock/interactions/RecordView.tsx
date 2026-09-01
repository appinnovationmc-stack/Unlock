"use client";

import { useEffect, useRef } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

/**
 * Fires CAMPAIGN_VIEW once per mount for authenticated users.
 * Server awards Impact only if rules allow (default: 1 pt, unverified ok).
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
      idempotencyKey: `view:${campaignId}:${new Date().toISOString().slice(0, 13)}` // hourly dedupe
    });
  }, [campaignId, creatorId]);

  return null;
}
