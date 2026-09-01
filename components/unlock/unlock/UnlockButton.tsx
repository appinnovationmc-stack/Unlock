"use client";
import { useCallback, useRef, useState, useEffect } from "react";

interface UnlockButtonProps {
  onUnlock: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  holdMs?: number;
}

export function UnlockButton({ onUnlock, disabled = false, label = "HOLD TO UNLOCK", holdMs = 1200 }: UnlockButtonProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "holding" | "unlocking" | "done">("idle");
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const unlockedRef = useRef(false);
  const clear = useCallback(() => { if (rafRef.current) cancelAnimationFrame(rafRef.current); startRef.current = null; }, []);
  const tick = useCallback(() => {
    if (startRef.current == null) return;
    const p = Math.min(1, (performance.now() - startRef.current) / holdMs);
    setProgress(p);
    if (p >= 1 && !unlockedRef.current) {
      unlockedRef.current = true; setPhase("unlocking");
      void Promise.resolve(onUnlock()).finally(() => setPhase("done")); return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, onUnlock]);
  const startHold = useCallback(() => {
    if (disabled || phase === "unlocking" || phase === "done") return;
    unlockedRef.current = false; setPhase("holding");
    startRef.current = performance.now(); rafRef.current = requestAnimationFrame(tick);
  }, [disabled, phase, tick]);
  const endHold = useCallback(() => {
    if (phase === "holding") { clear(); setProgress(0); setPhase("idle"); }
  }, [phase, clear]);
  useEffect(() => () => clear(), [clear]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); startHold(); } };
    const up = (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") endHold(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [startHold, endHold]);
  return (
    <button type="button" disabled={disabled || phase === "unlocking" || phase === "done"} aria-label={label} aria-pressed={phase !== "idle"}
      onPointerDown={(e) => { e.preventDefault(); startHold(); }} onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold}
      className={`relative w-full select-none overflow-hidden clip-keyhole border transition-all duration-300
        ${phase === "done" ? "border-gold bg-gold/20 text-gold" : phase === "unlocking" ? "border-volt bg-volt/10 text-volt" : "border-volt/40 bg-ink2 text-fog hover:border-volt hover:text-volt"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} py-5 px-6 font-display text-sm tracking-[0.25em] uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt`}>
      <span className="absolute inset-0 origin-left bg-volt/25" style={{ transform: `scaleX(${progress})`, opacity: phase === "holding" ? 1 : 0 }} aria-hidden />
      <span className="relative z-10 flex flex-col items-center gap-2">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${phase === "done" ? "border-gold text-gold" : "border-current"} transition-all duration-500`}
          style={{ boxShadow: phase === "holding" ? `0 0 ${12 + progress * 24}px rgba(198,255,61,${0.3 + progress * 0.5})` : phase === "done" ? "0 0 32px rgba(255,194,75,0.5)" : undefined }}>
          {phase === "done" ? "✓" : phase === "unlocking" ? "…" : "◎"}
        </span>
        <span>{phase === "done" ? "UNLOCKED" : phase === "unlocking" ? "UNLOCKING…" : label}</span>
      </span>
    </button>
  );
}
