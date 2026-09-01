"use client";

import { useState, useTransition } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

/**
 * Location-based verification for VISIT / geolocation mechanics.
 * Requests browser geolocation with clear purpose, then records LOCATION_CHECKIN.
 */
export function LocationCheckin({
  campaignId,
  locationId,
  label = "Check in here"
}: {
  campaignId: string;
  locationId?: string | null;
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCheckin() {
    setMessage(null);
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("Location is not available on this device.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        startTransition(async () => {
          const result = await recordInteraction({
            eventType: "LOCATION_CHECKIN",
            campaignId,
            locationId: locationId ?? undefined,
            verificationMethod: "location",
            metadata: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              source: "browser_geolocation"
            },
            idempotencyKey: `checkin:${campaignId}:${new Date().toISOString().slice(0, 13)}`
          });
          if (result.error) {
            setStatus("error");
            setMessage(result.error);
            return;
          }
          setStatus("done");
          setMessage("Checked in. +25 Impact when verified.");
        });
      },
      (err) => {
        setStatus("error");
        setMessage(
          err.code === 1
            ? "Location permission denied. Enable it to complete place-based challenges."
            : "Could not get your location. Try again outdoors."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  return (
    <div className="border border-white/10 bg-ink2/60 p-5 space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-volt">Verified visit</p>
      <p className="text-mute text-xs">
        We use your location only to verify this check-in — not for ads or tracking elsewhere.
      </p>
      <button
        type="button"
        onClick={handleCheckin}
        disabled={isPending || status === "locating" || status === "done"}
        className={`w-full font-mono text-[10px] uppercase tracking-widest py-3 border ${
          status === "done"
            ? "border-gold text-gold bg-gold/10"
            : "border-volt text-volt hover:bg-volt/10"
        } disabled:opacity-50`}
      >
        {status === "locating" || isPending
          ? "Locating…"
          : status === "done"
            ? "Checked in"
            : label}
      </button>
      {message && (
        <p className={`text-xs text-center ${status === "error" ? "text-magenta" : "text-mute"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
