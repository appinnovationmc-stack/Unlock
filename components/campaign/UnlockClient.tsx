"use client";

import { useState, useTransition } from "react";
import { UnlockReveal } from "@/components/campaign/UnlockReveal";
import { unlockCampaign } from "@/lib/actions/unlock";

export function UnlockClient({
  campaignId,
  rewardLabel
}: {
  campaignId: string;
  rewardLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <UnlockReveal
        label={rewardLabel}
        onRevealed={() => {
          startTransition(async () => {
            const result = await unlockCampaign(campaignId);
            setError(result.error);
            setAlreadyUnlocked(result.alreadyUnlocked);
          });
        }}
      />
      {error && (
        <p className="mt-3 text-center text-sm text-magenta">
          {error} <a href="/login" className="underline">Log in</a>
        </p>
      )}
      {alreadyUnlocked && (
        <p className="mt-3 text-center text-sm text-mute">You've already unlocked this one.</p>
      )}
      {isPending && <p className="mt-3 text-center text-xs text-mute font-mono">Recording unlock…</p>}
    </div>
  );
}
