"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareMoment } from "@/components/campaign/ShareMoment";
import { Button } from "@/components/ui/Button";

export function UnlockReveal({
  reward,
  impact,
  already,
  campaignId,
  campaignTitle
}: {
  reward: string;
  impact: number | null;
  already: boolean;
  campaignId: string;
  campaignTitle?: string;
}) {
  const [reduced, setReduced] = useState(false);
  const [show, setShow] = useState(false);
  void impact;

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
        aria-label={already ? "Already unlocked" : "You unlocked it"}
        className={`relative overflow-hidden border border-magenta/30 bg-ink p-8 text-center transition-opacity ${
          reduced ? "duration-0" : "duration-500"
        } ${show ? "opacity-100" : reduced ? "opacity-100" : "opacity-0"}`}
      >
        <p className="section-kicker text-magenta mb-3">
          {already ? "You already have this" : "You unlocked it"}
        </p>
        <h2 className="font-display text-3xl text-fog mb-2">{reward}</h2>
        {!already && <p className="text-mute text-sm mb-6">Added to your rewards</p>}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/wallet">
            <Button variant="ghost" className="border-magenta/40 text-magenta">
              See rewards
            </Button>
          </Link>
          <Link href="/discover">
            <Button variant="ghost">Explore again</Button>
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
