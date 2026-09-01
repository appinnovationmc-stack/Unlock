"use client";

import { useState, useTransition } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";
import { verifyLocationCheckin } from "@/lib/unlock/verification/location";

/**
 * Location-based verification for VISIT / geolocation mechanics.
 * 1) Record LOCATION_CHECKIN (pending)
 * 2) Call verify_location_checkin with coords (PostGIS radius check)
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
  const [status, setStatus] = useState<"idle" | "locating" | "done" | "error" | "rejected">("idle");
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
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        startTransition(async () => {
          const recorded = await recordInteraction({
            eventType: "LOCATION_CHECKIN",
            campaignId,
            locationId: locationId ?? undefined,
            verificationMethod: "location",
            metadata: { lat, lng, accuracy: pos.coords.accuracy, source: "browser_geolocation" },
            idempotencyKey: `checkin:${campaignId}:${new Date().toISOString().slice(0, 13)}`
          });

          if (recorded.error || !recorded.eventId) {
            setStatus("error");
            setMessage(recorded.error ?? "Could not record check-in");
            return;
          }

          const verified = await verifyLocationCheckin(recorded.eventId, lat, lng, campaignId);
          if (verified.error) {
            setStatus("error");
            setMessage(verified.error);
            return;
          }
          if (!verified.verified) {
            setStatus("rejected");
            setMessage("You are outside the experience radius. Move closer to the location pin.");
            return;
          }

          setStatus("done");
          const dist =
            verified.distanceM != null ? ` (${Math.round(verified.distanceM)}m from pin)` : "";
          setMessage(`Checked in and verified${dist}. Impact awarded.`);
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
            : status === "rejected"
              ? "border-magenta text-magenta"
              : "border-volt text-volt hover:bg-volt/10"
        } disabled:opacity-50`}
      >
        {status === "locating" || isPending
          ? "Locating & verifying…"
          : status === "done"
            ? "Checked in"
            : status === "rejected"
              ? "Outside radius — try again"
              : label}
      </button>
      {message && (
        <p
          className={`text-xs text-center ${
            status === "error" || status === "rejected" ? "text-magenta" : "text-mute"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
