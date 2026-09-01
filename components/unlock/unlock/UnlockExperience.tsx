"use client";
import { useState, useTransition } from "react";
import { UnlockButton } from "./UnlockButton";
import { recordInteraction } from "@/lib/unlock/interactions/record";
import { unlockCampaign } from "@/lib/actions/unlock";
import Link from "next/link";

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
          verificationMethod: "referral",
          metadata: { source: "unlock_with_ref" },
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
      <div className="relative overflow-hidden clip-keyhole border border-gold/40 bg-ink2 p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-gold mb-3">{result.already ? "Already unlocked" : "UNLOCKED"}</p>
        <h2 className="font-display text-3xl text-fog text-glow-volt mb-2">{result.reward ?? rewardLabel}</h2>
        {!result.already && <p className="font-mono text-volt text-sm tracking-widest mb-6">+{result.xp || impactHint} IMPACT</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/wallet" className="font-mono text-[10px] uppercase tracking-widest border border-gold/50 text-gold px-4 py-2 hover:bg-gold/10">View in wallet</Link>
          <Link href="/discover" className="font-mono text-[10px] uppercase tracking-widest border border-white/15 text-mute px-4 py-2 hover:text-fog">More experiences</Link>
        </div>
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="border border-magenta/40 bg-ink2 p-6 text-center">
        <p className="text-magenta text-sm mb-3">{error ?? "Something went wrong."}</p>
        <button type="button" onClick={() => { setError(null); setPhase("ready"); }}
          className="font-mono text-[10px] uppercase tracking-widest text-fog border border-white/20 px-3 py-1.5">Try again</button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {campaignTitle && <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-mute text-center">{campaignTitle}</p>}
      <UnlockButton onUnlock={handleUnlock} disabled={isPending || phase === "confirming"} label={phase === "confirming" ? "CONFIRMING…" : "HOLD TO UNLOCK"} />
      <p className="text-center text-mute text-xs">Hold the keyhole. The system confirms. The reward is yours.</p>
    </div>
  );
}
