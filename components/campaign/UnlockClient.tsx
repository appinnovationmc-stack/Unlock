"use client";
import { UnlockExperience } from "@/components/unlock/unlock/UnlockExperience";
import { ShareMoment } from "@/components/campaign/ShareMoment";

export function UnlockClient({ campaignId, rewardLabel, campaignTitle, referrerCreatorId }: {
  campaignId: string; rewardLabel: string; campaignTitle?: string; referrerCreatorId?: string | null;
}) {
  return (
    <div className="space-y-6">
      <UnlockExperience campaignId={campaignId} rewardLabel={rewardLabel} campaignTitle={campaignTitle} referrerCreatorId={referrerCreatorId} />
      <ShareMoment campaignId={campaignId} title={campaignTitle || "Unlock"} rewardHint={rewardLabel} />
    </div>
  );
}
