"use client";
import { UnlockExperience } from "@/components/unlock/unlock/UnlockExperience";

export function UnlockClient({ campaignId, rewardLabel, campaignTitle, referrerCreatorId }: {
  campaignId: string; rewardLabel: string; campaignTitle?: string; referrerCreatorId?: string | null;
}) {
  return (
    <UnlockExperience
      campaignId={campaignId}
      rewardLabel={rewardLabel}
      campaignTitle={campaignTitle}
      referrerCreatorId={referrerCreatorId}
    />
  );
}
