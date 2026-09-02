"use client";

import { useState } from "react";
import { UnlockButton } from "@/components/unlock/unlock/UnlockButton";
import { prefersReducedMotion } from "@/lib/unlock/reduced-motion";

/**
 * Brand-side "Play experience" — same hold-to-unlock language as consumers,
 * without writing production events. Sales demo + QA.
 */
export function PlayExperience({
  title,
  tagline,
  rewardLabel
}: {
  title: string;
  tagline?: string | null;
  rewardLabel?: string | null;
}) {
  const [phase, setPhase] = useState<"ready" | "unlocked">("ready");

  if (phase === "unlocked") {
    return (
      <div className="border border-gold/40 bg-ink2 p-8 text-center clip-keyhole">
        <p className="section-kicker text-gold mb-3">Unlocked · demo</p>
        <h2 className="font-display text-2xl text-fog mb-2">{rewardLabel || "Reward"}</h2>
        <p className="text-mute text-sm mb-6">Demo only — no Impact awarded</p>
        <button
          type="button"
          onClick={() => setPhase("ready")}
          className="text-sm border border-white/15 text-mute px-4 py-2 hover:text-fog focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
        >
          Play again
        </button>
        <p className="mt-4 text-mute text-xs">Demo only — no events written</p>
      </div>
    );
  }

  return (
    <div className="border border-white/10 bg-void p-6 space-y-4 clip-keyhole">
      <p className="section-kicker text-center">Play experience</p>
      <div className="text-center">
        <p className="font-display text-xl text-fog">{title}</p>
        {tagline && <p className="text-mute text-sm mt-1">{tagline}</p>}
      </div>
      <UnlockButton
        onUnlock={async () => {
          const wait = prefersReducedMotion() ? 0 : 400;
          if (wait) await new Promise((r) => setTimeout(r, wait));
          setPhase("unlocked");
        }}
      />
      <p className="text-center text-mute text-xs">Same interaction consumers feel — for demos and QA.</p>
    </div>
  );
}
