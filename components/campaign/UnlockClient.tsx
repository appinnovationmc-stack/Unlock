"use client";

import { useState, useTransition } from "react";
import { UnlockReveal } from "@/components/campaign/UnlockReveal";
import { ShareMoment } from "@/components/campaign/ShareMoment";
import { unlockCampaign } from "@/lib/actions/unlock";
import Link from "next/link";

export function UnlockClient({
  campaignId,
  rewardLabel,
  campaignTitle,
  referrerCreatorId
}: {
  campaignId: string;
  rewardLabel: string;
  campaignTitle?: string;
  referrerCreatorId?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [alreadyUnlocked, setAlreadyUnlocked] = useState(false);
  const [success, setSuccess] = useState<{ xp: number; reward: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <UnlockReveal
        label={rewardLabel}
        onRevealed={() => {
          startTransition(async () => {
            const result = await unlockCampaign(campaignId, referrerCreatorId);
            setError(result.error);
            setAlreadyUnlocked(result.alreadyUnlocked);
            if (!result.error && !result.alreadyUnlocked) {
              setSuccess({
                xp: result.xpAwarded,
                reward: result.rewardLabel
              });
            }
          });
        }}
      />
      {error && (
        <p className="mt-3 text-center text-sm text-magenta">
          {error}{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      )}
      {alreadyUnlocked && (
        <div className="mt-4 space-y-3">
          <p className="text-center text-sm text-mute">
            Already in your collection.{" "}
            <Link href="/wallet" className="text-volt underline">
              Open collection
            </Link>
          </p>
          <ShareMoment
            campaignId={campaignId}
            title={campaignTitle || "Unlock"}
            rewardHint={rewardLabel}
          />
        </div>
      )}
      {success && (
        <div className="mt-6 space-y-4">
          <div className="text-center space-y-2">
            <p className="font-display text-gold text-2xl text-glow-volt">Unlocked</p>
            <p className="font-mono text-sm text-volt">+{success.xp} XP</p>
            {success.reward && (
              <p className="text-sm text-fog">In your collection: {success.reward}</p>
            )}
          </div>

          <ShareMoment
            campaignId={campaignId}
            title={campaignTitle || "Unlock"}
            rewardHint={success.reward || rewardLabel}
          />

          <div className="text-center">
            <Link
              href="/wallet"
              className="inline-block font-mono text-xs uppercase tracking-widest text-volt border border-volt/40 px-3 py-1.5 hover:bg-volt/10"
            >
              Open collection →
            </Link>
          </div>
        </div>
      )}
      {isPending && (
        <p className="mt-3 text-center text-xs text-mute font-mono">Sealing the unlock…</p>
      )}
    </div>
  );
}
