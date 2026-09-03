"use client";
import { useCallback, useRef, useState, useEffect } from "react";
import { prefersReducedMotion } from "@/lib/unlock/reduced-motion";

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
  const [reduced, setReduced] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const clear = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    setPhase("unlocking");
    void Promise.resolve(onUnlock()).finally(() => setPhase("done"));
  }, [onUnlock]);

  const tick = useCallback(() => {
    if (startRef.current == null) return;
    const p = Math.min(1, (performance.now() - startRef.current) / holdMs);
    setProgress(p);
    if (p >= 1) {
      finish();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, finish]);

  const startHold = useCallback(() => {
    if (disabled || phase === "unlocking" || phase === "done") return;
    unlockedRef.current = false;
    if (reduced || prefersReducedMotion()) {
      finish();
      return;
    }
    setPhase("holding");
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, phase, tick, finish, reduced]);

  const endHold = useCallback(() => {
    if (phase === "holding") {
      clear();
      setProgress(0);
      setPhase("idle");
    }
  }, [phase, clear]);

  useEffect(() => () => clear(), [clear]);

  const status =
    phase === "done" ? "Unlocked" : phase === "unlocking" ? "Opening…" : label;

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
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") endHold();
        }}
        className={`relative h-28 w-28 select-none rounded-full unlock-glass motion-safe:transition-colors
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fog
          ${
            phase === "done"
              ? "text-magenta"
              : phase === "unlocking"
                ? "text-fog"
                : "text-fog"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        style={{
          background:
            phase === "holding" && !reduced
              ? `conic-gradient(rgba(17,17,17,0.7) ${progress * 360}deg, rgba(255,255,255,0.25) 0)`
              : undefined
        }}
      >
        <span
          className="absolute inset-2 rounded-full unlock-glass flex items-center justify-center font-display text-2xl"
          aria-hidden
        >
          {phase === "done" ? "✓" : phase === "unlocking" ? "…" : "◎"}
        </span>
      </button>
      <p className="text-sm text-mute">{status}</p>
    </div>
  );
}
