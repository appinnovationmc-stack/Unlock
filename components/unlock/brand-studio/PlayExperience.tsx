"use client";

import { useState } from "react";
import { UnlockButton } from "@/components/unlock/unlock/UnlockButton";

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
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-gold mb-3">Unlocked · demo</p>
        <h2 className="font-display text-2xl text-fog mb-2">
          {rewardLabel || "Reward"}
        </h2>
        <p className="text-mute text-sm mb-6">Demo only — no Impact awarded</p>
        <button
          type="button"
          onClick={() => setPhase("ready")}
          className="font-mono text-[10px] uppercase tracking-widest border border-white/15 text-mute px-4 py-2 hover:text-fog"
        >
          Play again
        </button>
        <p className="mt-4 text-mute text-[10px] font-mono">Demo only — no events written</p>
      </div>
    );
  }

  return (
    <div className="border border-white/10 bg-void p-6 space-y-4 clip-keyhole">
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-magenta text-center">Play experience</p>
      <div className="text-center">
        <p className="font-display text-xl text-fog">{title}</p>
        {tagline && <p className="text-mute text-sm mt-1">{tagline}</p>}
      </div>
      <UnlockButton
        onUnlock={async () => {
          await new Promise((r) => setTimeout(r, 400));
          setPhase("unlocked");
        }}
      />
      <p className="text-center text-mute text-xs">Same interaction consumers feel — for demos and QA.</p>
    </div>
  );
}
