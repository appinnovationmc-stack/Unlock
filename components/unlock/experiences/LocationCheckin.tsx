"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { recordInteraction } from "@/lib/unlock/interactions/record";
import { verifyLocationCheckin } from "@/lib/unlock/verification/location";
import { campaignLoginHref } from "@/lib/auth/safe-next";

export function LocationCheckin({
  campaignId,
  locationId,
  creatorId,
  label = "Check in here",
  authenticated = false,
  onVerified
}: {
  campaignId: string;
  locationId?: string | null;
  creatorId?: string | null;
  label?: string;
  authenticated?: boolean;
  onVerified?: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "done" | "error" | "rejected">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCheckin() {
    setMessage(null);
    if (!authenticated) {
      window.location.assign(campaignLoginHref(campaignId));
      return;
    }
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("Location is not available on this device.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        startTransition(async () => {
          const recorded = await recordInteraction({
            eventType: "LOCATION_CHECKIN",
            campaignId,
            locationId: locationId ?? undefined,
            creatorId: creatorId ?? undefined,
            verificationMethod: "location",
            metadata: { lat, lng, accuracy: pos.coords.accuracy, source: "browser_geolocation" },
            idempotencyKey: `checkin:${campaignId}:${new Date().toISOString().slice(0, 13)}`
          });

          if (recorded.error || !recorded.eventId) {
            setStatus("error");
            setMessage(recorded.error ?? "Could not record check-in");
            return;
          }

          const verified = await verifyLocationCheckin(
            recorded.eventId,
            lat,
            lng,
            campaignId,
            locationId ?? undefined
          );
          if (verified.error) {
            setStatus("error");
            setMessage(verified.error);
            return;
          }
          if (!verified.verified) {
            setStatus("rejected");
            setMessage("Too far from the pin. Move closer.");
            return;
          }

          setStatus("done");
          setMessage(null);
          onVerified?.();
        });
      },
      (err) => {
        setStatus("error");
        setMessage(
          err.code === 1 ? "Location permission denied." : "Could not get your location."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  const buttonClass = `w-full font-mono text-[10px] tracking-widest py-2.5 border ${
    status === "done"
      ? "border-gold/40 text-gold"
      : status === "rejected"
        ? "border-white/20 text-mute"
        : "border-white/15 text-mute hover:text-fog hover:border-white/30"
  } disabled:opacity-50`;

  if (!authenticated) {
    return (
      <div className="space-y-2">
        <Link href={campaignLoginHref(campaignId)} className={`${buttonClass} block text-center`}>
          {label}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCheckin}
        disabled={isPending || status === "locating" || status === "done"}
        className={buttonClass}
      >
        {status === "locating" || isPending
          ? "Checking in…"
          : status === "done"
            ? "Checked in"
            : status === "rejected"
              ? "Too far — try again"
              : label}
      </button>
      {message && <p className="text-xs text-center text-mute">{message}</p>}
    </div>
  );
}
