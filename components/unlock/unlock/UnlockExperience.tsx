"use client";
import { useRef, useState, useTransition } from "react";
import { UnlockButton } from "./UnlockButton";
import { unlockCampaign } from "@/lib/actions/unlock";
import { UnlockReveal } from "./UnlockReveal";
import { LocationCheckin } from "@/components/unlock/experiences/LocationCheckin";
import { Button } from "@/components/ui/Button";

export function UnlockExperience({
  campaignId,
  rewardLabel,
  campaignTitle,
  referrerCreatorId,
  requireVisit = false
}: {
  campaignId: string;
  rewardLabel: string;
  campaignTitle?: string;
  referrerCreatorId?: string | null;
  requireVisit?: boolean;
}) {
  const [phase, setPhase] = useState<"ready" | "confirming" | "revealed" | "error">("ready");
  const [checkedIn, setCheckedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    impact: number | null;
    reward: string | null;
    already: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const inFlightRef = useRef(false);

  const handleUnlock = () => {
    if (inFlightRef.current) return;
    if (requireVisit && !checkedIn) {
      setError("Check in at the place first");
      setPhase("error");
      return;
    }
    inFlightRef.current = true;
    setPhase("confirming");
    startTransition(async () => {
      const res = await unlockCampaign(campaignId, referrerCreatorId);
      if (res.error && !res.alreadyUnlocked) {
        inFlightRef.current = false;
        setError(res.error);
        setPhase("error");
        return;
      }
      setResult({
        impact: res.impactAwarded,
        reward: res.rewardLabel ?? rewardLabel,
        already: res.alreadyUnlocked
      });
      setPhase("revealed");
    });
  };

  if (phase === "revealed" && result) {
    return (
      <UnlockReveal
        reward={result.reward ?? rewardLabel}
        impact={result.impact}
        already={result.already}
        campaignId={campaignId}
        campaignTitle={campaignTitle}
      />
    );
  }
  if (phase === "error") {
    return (
      <div className="space-y-4">
        {requireVisit && !checkedIn && (
          <LocationCheckin
            campaignId={campaignId}
            creatorId={referrerCreatorId}
            onVerified={() => {
              setCheckedIn(true);
              setError(null);
              setPhase("ready");
            }}
          />
        )}
        <div className="border border-white/15 bg-ink2 p-6 text-center">
          <p className="text-fog text-sm mb-3">{error ?? "Something went wrong."}</p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              setPhase("ready");
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {requireVisit && !checkedIn && (
        <LocationCheckin
          campaignId={campaignId}
          creatorId={referrerCreatorId}
          onVerified={() => setCheckedIn(true)}
        />
      )}
      <UnlockButton
        onUnlock={handleUnlock}
        disabled={isPending || phase === "confirming" || (requireVisit && !checkedIn)}
        label={
          phase === "confirming"
            ? "Confirming…"
            : requireVisit && !checkedIn
              ? "Check in first"
              : "Hold to unlock"
        }
      />
    </div>
  );
}
