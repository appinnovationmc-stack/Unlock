"use client";

import { useState } from "react";
import { prefersReducedMotion } from "@/lib/unlock/reduced-motion";

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
    <div className="relative w-full aspect-[3/2] clip-keyhole overflow-hidden bg-void border border-white/15">
      <div className="absolute inset-0 flex items-center justify-center bg-ink2">
        <span className="font-display text-2xl text-gold">{label}</span>
      </div>

      {phase !== "open" && (
        <button
          type="button"
          aria-label="Unlock reward"
          disabled={phase === "tearing"}
          onClick={() => {
            if (phase !== "locked") return;
            onRevealed?.();
            if (prefersReducedMotion()) {
              setPhase("open");
              return;
            }
            setPhase("tearing");
            window.setTimeout(() => setPhase("open"), 600);
          }}
          className={`absolute inset-0 bg-ink2 flex flex-col items-center justify-center gap-2
            font-display text-fog/80 hover:text-volt motion-safe:transition-colors
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt
            ${phase === "tearing" ? "unlock-foil" : ""}`}
        >
          <span className="text-3xl" aria-hidden>
            ◎
          </span>
          <span className="text-sm">{phase === "tearing" ? "Unlocking…" : "Tap to unlock"}</span>
        </button>
      )}
    </div>
  );
}
