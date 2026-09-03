"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { UnlockButton } from "./UnlockButton";
import { unlockCampaign } from "@/lib/actions/unlock";
import { UnlockReveal } from "./UnlockReveal";
import { LocationCheckin } from "@/components/unlock/experiences/LocationCheckin";
import { Button } from "@/components/ui/Button";
import { campaignLoginHref } from "@/lib/auth/safe-next";

export function UnlockExperience({
  campaignId,
  rewardLabel,
  campaignTitle,
  referrerCreatorId,
  requireVisit = false,
  authenticated = false,
  pinLocationIds = []
}: {
  campaignId: string;
  rewardLabel: string;
  campaignTitle?: string;
  referrerCreatorId?: string | null;
  requireVisit?: boolean;
  authenticated?: boolean;
  pinLocationIds?: string[];
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

  // Single public pin → pin-explicit record. Multiple pins → omit locationId;
  // verify_location_checkin matches GPS to any campaign pin server-side.
  const locationId = pinLocationIds.length === 1 ? pinLocationIds[0] : null;

  const handleUnlock = () => {
    if (!authenticated) {
      window.location.assign(campaignLoginHref(campaignId));
      return;
    }
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

  const checkin = requireVisit && !checkedIn && (
    <LocationCheckin
      campaignId={campaignId}
      locationId={locationId}
      creatorId={referrerCreatorId}
      authenticated={authenticated}
      onVerified={() => {
        setCheckedIn(true);
        setError(null);
        setPhase("ready");
      }}
    />
  );

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
        {checkin}
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

  if (!authenticated) {
    return (
      <div className="space-y-4">
        {requireVisit && (
          <LocationCheckin
            campaignId={campaignId}
            locationId={locationId}
            creatorId={referrerCreatorId}
            authenticated={false}
          />
        )}
        <div className="flex flex-col items-center gap-3 py-2">
          <Link
            href={campaignLoginHref(campaignId)}
            aria-label="Hold to unlock"
            className="relative h-28 w-28 select-none rounded-full border-2 border-white/25 text-fog bg-ink2 hover:border-volt/60 motion-safe:transition-colors motion-safe:duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
          >
            <span
              className="absolute inset-2 rounded-full bg-ink2 flex items-center justify-center font-display text-2xl"
              aria-hidden
            >
              ◎
            </span>
          </Link>
          <p className="text-sm text-mute">Hold to unlock</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requireVisit && !checkedIn && (
        <LocationCheckin
          campaignId={campaignId}
          locationId={locationId}
          creatorId={referrerCreatorId}
          authenticated
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
