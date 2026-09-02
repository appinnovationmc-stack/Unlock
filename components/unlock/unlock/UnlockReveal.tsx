"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareMoment } from "@/components/campaign/ShareMoment";

export function UnlockReveal({
  reward,
  impact,
  already,
  campaignId,
  campaignTitle
}: {
  reward: string;
  impact: number;
  already: boolean;
  campaignId: string;
  campaignTitle?: string;
}) {
  const [reduced, setReduced] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    const t = requestAnimationFrame(() => setShow(true));
    try {
      if ("vibrate" in navigator && !mq.matches) navigator.vibrate([12, 30, 18]);
    } catch {}
    return () => {
      mq.removeEventListener("change", onChange);
      cancelAnimationFrame(t);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div
        role="status"
        aria-live="polite"
        aria-label={already ? "Already unlocked" : "Unlocked"}
        className={`relative overflow-hidden clip-keyhole border border-gold/40 bg-ink2 p-8 text-center transition-all ${
          reduced ? "duration-0" : "duration-500"
        } ${show ? "opacity-100 scale-100" : reduced ? "opacity-100" : "opacity-0 scale-95"}`}
      >
        {!reduced && (
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{ background: "radial-gradient(circle at 50% 30%, rgba(255,194,75,0.25), transparent 55%)" }}
            aria-hidden
          />
        )}
        <p className="relative font-mono text-[10px] tracking-[0.35em] text-gold mb-3">
          {already ? "Already unlocked" : "Unlocked"}
        </p>
        <h2 className="relative font-display text-3xl text-fog mb-2">{reward}</h2>
        {!already && (
          <p className="relative font-mono text-gold text-sm tracking-widest mb-6">+{impact} impact</p>
        )}
        <div className="relative flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/wallet" className="font-mono text-[10px] tracking-widest border border-gold/50 text-gold px-4 py-2 hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt">
            View in wallet
          </Link>
          <Link href="/discover" className="font-mono text-[10px] tracking-widest border border-white/15 text-mute px-4 py-2 hover:text-fog focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt">
            More experiences
          </Link>
          <Link href={`/campaign/${campaignId}`} className="font-mono text-[10px] tracking-widest border border-white/15 text-mute px-4 py-2 hover:text-fog focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt">
            Stay here
          </Link>
        </div>
      </div>

      <ShareMoment
        campaignId={campaignId}
        title={campaignTitle || "Unlock"}
        rewardHint={reward}
        celebrated
      />
    </div>
  );
}
