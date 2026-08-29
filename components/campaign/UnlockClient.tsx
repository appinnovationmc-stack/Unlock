"use client";

import { useState, useTransition } from "react";
import { UnlockReveal } from "@/components/campaign/UnlockReveal";
import { unlockCampaign } from "@/lib/actions/unlock";
import Link from "next/link";

export function UnlockClient({
  campaignId,
  rewardLabel
}: {
  campaignId: string;
  rewardLabel: string;
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
            const result = await unlockCampaign(campaignId);
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
        <p className="mt-3 text-center text-sm text-mute">
          You&apos;ve already unlocked this one.{" "}
          <Link href="/wallet" className="text-volt underline">
            View wallet
          </Link>
        </p>
      )}
      {success && (
        <div className="mt-4 text-center space-y-2">
          <p className="font-display text-gold text-lg">Unlocked</p>
          <p className="font-mono text-sm text-volt">+{success.xp} XP</p>
          {success.reward && (
            <p className="text-sm text-fog">Reward claimed: {success.reward}</p>
          )}
          <Link
            href="/wallet"
            className="inline-block mt-2 font-mono text-xs uppercase tracking-widest text-volt border border-volt/40 px-3 py-1.5 hover:bg-volt/10"
          >
            Open wallet →
          </Link>
        </div>
      )}
      {isPending && (
        <p className="mt-3 text-center text-xs text-mute font-mono">Recording unlock…</p>
      )}
    </div>
  );
}
