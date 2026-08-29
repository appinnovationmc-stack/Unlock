"use client";

import { useState } from "react";

interface UnlockRevealProps {
  label: string;
  onRevealed?: () => void;
}

/**
 * Signature unlock moment: foil stays until tap, then tears away.
 */
export function UnlockReveal({ label, onRevealed }: UnlockRevealProps) {
  const [phase, setPhase] = useState<"locked" | "tearing" | "open">("locked");

  return (
    <div className="relative w-full aspect-[3/2] clip-keyhole overflow-hidden bg-void border border-volt/30">
      <div className="absolute inset-0 flex items-center justify-center bg-ink2">
        <span className="font-display text-2xl text-gold text-glow-volt">{label}</span>
      </div>

      {phase !== "open" && (
        <button
          type="button"
          aria-label="Unlock reward"
          disabled={phase === "tearing"}
          onClick={() => {
            if (phase !== "locked") return;
            setPhase("tearing");
            onRevealed?.();
            window.setTimeout(() => setPhase("open"), 600);
          }}
          className={`absolute inset-0 bg-duotone bg-ink flex flex-col items-center justify-center gap-2
            font-display uppercase tracking-widest text-fog/80 hover:text-volt transition-colors
            ${phase === "tearing" ? "unlock-foil" : ""}`}
        >
          <span className="text-3xl">🔓</span>
          <span className="text-sm">{phase === "tearing" ? "Unlocking…" : "Tap to unlock"}</span>
        </button>
      )}
    </div>
  );
}
