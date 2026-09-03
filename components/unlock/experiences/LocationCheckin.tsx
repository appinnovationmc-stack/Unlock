"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { recordInteraction } from "@/lib/unlock/interactions/record";
import { verifyLocationCheckin } from "@/lib/unlock/verification/location";
import { campaignLoginHref } from "@/lib/auth/safe-next";

const GPS_PRIVACY = "Location is only used to see if you are at the place.";

export function LocationCheckin({
  campaignId,
  locationId,
  creatorId,
  label = "I'm here",
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
      setMessage("This device cannot share a location.");
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
            setMessage(recorded.error ?? "Could not confirm you are here.");
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
            setMessage("A little closer.");
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
          err.code === 1 ? "Allow location to continue." : "Could not find you yet."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  const buttonClass = `w-full min-h-11 text-sm py-3 border ${
    status === "done"
      ? "border-magenta/40 text-magenta"
      : status === "rejected"
        ? "border-black/15 text-mute"
        : "border-black/15 text-fog hover:border-volt"
  } disabled:opacity-50`;

  if (!authenticated) {
    return (
      <div className="space-y-2">
        <Link
          href={{ pathname: "/login", query: { next: `/campaign/${campaignId}` } }}
          className={`${buttonClass} block text-center`}
        >
          {label}
        </Link>
        <p className="text-xs text-center text-mute">{GPS_PRIVACY}</p>
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
          ? "Finding you…"
          : status === "done"
            ? "You're here"
            : status === "rejected"
              ? "A little closer"
              : label}
      </button>
      <p className="text-xs text-center text-mute">{GPS_PRIVACY}</p>
      {message && <p className="text-xs text-center text-mute">{message}</p>}
    </div>
  );
}
