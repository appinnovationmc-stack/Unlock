"use client";

import { useState } from "react";

interface UnlockRevealProps {
  label: string; // e.g. "20% OFF", "Front Row Tickets"
  onRevealed?: () => void;
}

/**
 * The platform's signature moment. Every campaign resolves here: a foil
 * surface (the "lock") that tears diagonally away — echoing the keyhole
 * clip-path used on cards elsewhere — to expose the reward underneath.
 * Reused for: prize reveals, hidden-price mechanics, product unlocks.
 */
export function UnlockReveal({ label, onRevealed }: UnlockRevealProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative w-full aspect-[3/2] clip-keyhole overflow-hidden bg-void border border-volt/30">
      <div className="absolute inset-0 flex items-center justify-center bg-ink2">
        <span className="font-display text-2xl text-gold text-glow-volt">{label}</span>
      </div>

      {!revealed && (
        <button
          aria-label="Unlock reward"
          onClick={() => {
            setRevealed(true);
            onRevealed?.();
          }}
          className="unlock-foil absolute inset-0 bg-duotone bg-ink flex flex-col items-center justify-center gap-2
            font-display uppercase tracking-widest text-fog/80 hover:text-volt transition-colors"
        >
          <span className="text-3xl">🔓</span>
          <span className="text-sm">Tap to unlock</span>
        </button>
      )}
    </div>
  );
}
