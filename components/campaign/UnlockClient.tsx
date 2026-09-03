"use client";

import { useMemo } from "react";
import { UnlockExperience } from "@/components/unlock/unlock/UnlockExperience";
import { PersistReferrer, readStoredReferrer } from "@/components/campaign/PersistReferrer";

export function UnlockClient({
  campaignId,
  rewardLabel,
  campaignTitle,
  referrerCreatorId,
  requireVisit = false,
  authenticated = false,
  pinLocationIds = []
}: {
  campaignId: string;
  rewardLabel: string;
  campaignTitle?: string;
  referrerCreatorId?: string | null;
  requireVisit?: boolean;
  authenticated?: boolean;
  pinLocationIds?: string[];
}) {
  const resolvedRef = useMemo(() => {
    return referrerCreatorId || readStoredReferrer(campaignId);
  }, [campaignId, referrerCreatorId]);

  return (
    <>
      <PersistReferrer campaignId={campaignId} referrerCreatorId={referrerCreatorId} />
      <UnlockExperience
        campaignId={campaignId}
        rewardLabel={rewardLabel}
        campaignTitle={campaignTitle}
        referrerCreatorId={resolvedRef}
        requireVisit={requireVisit}
        authenticated={authenticated}
        pinLocationIds={pinLocationIds}
      />
    </>
  );
}
