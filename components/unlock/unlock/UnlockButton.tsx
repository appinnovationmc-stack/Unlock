"use client";
import { useCallback, useRef, useState, useEffect } from "react";

interface UnlockButtonProps {
  onUnlock: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  holdMs?: number;
}

export function UnlockButton({
  onUnlock,
  disabled = false,
  label = "Hold to unlock",
  holdMs = 1200
}: UnlockButtonProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "holding" | "unlocking" | "done">("idle");
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);
  const clear = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
  }, []);
  const tick = useCallback(() => {
    if (startRef.current == null) return;
    const p = Math.min(1, (performance.now() - startRef.current) / holdMs);
    setProgress(p);
    if (p >= 1 && !unlockedRef.current) {
      unlockedRef.current = true;
      setPhase("unlocking");
      void Promise.resolve(onUnlock()).finally(() => setPhase("done"));
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, onUnlock]);
  const startHold = useCallback(() => {
    if (disabled || phase === "unlocking" || phase === "done") return;
    unlockedRef.current = false;
    setPhase("holding");
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, phase, tick]);
  const endHold = useCallback(() => {
    if (phase === "holding") {
      clear();
      setProgress(0);
      setPhase("idle");
    }
  }, [phase, clear]);
  useEffect(() => () => clear(), [clear]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        startHold();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") endHold();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [startHold, endHold]);

  const status =
    phase === "done" ? "Unlocked" : phase === "unlocking" ? "Confirming…" : label;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <button
        type="button"
        disabled={disabled || phase === "unlocking" || phase === "done"}
        aria-label={label}
        aria-pressed={phase !== "idle"}
        onPointerDown={(e) => {
          e.preventDefault();
          startHold();
        }}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        className={`relative h-28 w-28 select-none rounded-full border-2 transition-colors duration-300
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt
          ${
            phase === "done"
              ? "border-gold text-gold bg-gold/10"
              : phase === "unlocking"
                ? "border-volt text-volt bg-volt/5"
                : "border-white/25 text-fog bg-ink2 hover:border-volt/60"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        style={{
          background:
            phase === "holding"
              ? `conic-gradient(rgba(198,255,61,0.55) ${progress * 360}deg, rgba(255,255,255,0.06) 0)`
              : undefined
        }}
      >
        <span
          className="absolute inset-2 rounded-full bg-ink2 flex items-center justify-center font-display text-2xl"
          aria-hidden
        >
          {phase === "done" ? "✓" : phase === "unlocking" ? "…" : "◎"}
        </span>
      </button>
      <p className="font-mono text-xs tracking-wide text-mute">{status}</p>
    </div>
  );
}
