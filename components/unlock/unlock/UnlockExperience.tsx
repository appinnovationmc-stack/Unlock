"use client";
import { useState, useTransition } from "react";
import { UnlockButton } from "./UnlockButton";
import { recordInteraction } from "@/lib/unlock/interactions/record";
import { unlockCampaign } from "@/lib/actions/unlock";
import { UnlockReveal } from "./UnlockReveal";

export function UnlockExperience({ campaignId, rewardLabel, campaignTitle, referrerCreatorId, impactHint = 10 }: {
  campaignId: string; rewardLabel: string; campaignTitle?: string; referrerCreatorId?: string | null; impactHint?: number;
}) {
  const [phase, setPhase] = useState<"ready" | "confirming" | "revealed" | "error">("ready");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ xp: number; reward: string | null; already: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUnlock = () => {
    setPhase("confirming");
    startTransition(async () => {
      await recordInteraction({
        eventType: "CHALLENGE_START",
        campaignId,
        creatorId: referrerCreatorId ?? undefined,
        verificationMethod: "authenticated_session",
        metadata: { source: "unlock_moment" },
        idempotencyKey: `start:${campaignId}:${Date.now().toString(36)}`
      });

      await recordInteraction({
        eventType: "REWARD_UNLOCK", campaignId, creatorId: referrerCreatorId ?? undefined,
        verificationMethod: "authenticated_session", metadata: { source: "unlock_moment" },
        idempotencyKey: `unlock:${campaignId}:${Date.now().toString(36)}`
      });
      const res = await unlockCampaign(campaignId, referrerCreatorId);
      if (res.error && !res.alreadyUnlocked) { setError(res.error); setPhase("error"); return; }
      if (!res.alreadyUnlocked && referrerCreatorId) {
        void recordInteraction({
          eventType: "REFERRAL_CONVERSION",
          campaignId,
          creatorId: referrerCreatorId,
          verificationMethod: "authenticated_session",
          metadata: { source: "unlock_with_ref", referral: true },
          idempotencyKey: `refconv:${campaignId}:${referrerCreatorId}`
        });
      }
      if (!res.alreadyUnlocked) {
        void recordInteraction({
          eventType: "CHALLENGE_COMPLETE",
          campaignId,
          creatorId: referrerCreatorId ?? undefined,
          verificationMethod: "authenticated_session",
          metadata: { source: "unlock_moment" },
          idempotencyKey: `complete:${campaignId}:${Date.now().toString(36)}`
        });
      }
      setResult({ xp: res.xpAwarded, reward: res.rewardLabel ?? rewardLabel, already: res.alreadyUnlocked });
      setPhase("revealed");
    });
  };

  if (phase === "revealed" && result) {
    return (
      <UnlockReveal
        reward={result.reward ?? rewardLabel}
        impact={result.xp || impactHint}
        already={result.already}
        campaignId={campaignId}
        campaignTitle={campaignTitle}
      />
    );
  }
  if (phase === "error") {
    return (
      <div className="border border-white/15 bg-ink2 p-6 text-center">
        <p className="text-fog text-sm mb-3">{error ?? "Something went wrong."}</p>
        <button type="button" onClick={() => { setError(null); setPhase("ready"); }}
          className="font-mono text-[10px] tracking-widest text-mute border border-white/20 px-3 py-1.5">Try again</button>
      </div>
    );
  }
  return (
    <UnlockButton
      onUnlock={handleUnlock}
      disabled={isPending || phase === "confirming"}
      label={phase === "confirming" ? "Confirming…" : "Hold to unlock"}
    />
  );
}
