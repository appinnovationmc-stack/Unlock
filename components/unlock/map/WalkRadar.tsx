"use client";

import { useEffect, useState } from "react";

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function line(m: number) {
  if (m < 25) return "You're here";
  if (m < 1000) return `${Math.round(m)} m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

export function mapsWalkUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

export function appleWalkUrl(lat: number, lng: number) {
  return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`;
}

export function WalkRadar({
  lat,
  lng,
  radiusM = 150
}: {
  lat: number;
  lng: number;
  radiusM?: number;
}) {
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setMsg("This device cannot share a location.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setMsg(err.code === 1 ? "Allow location to walk there." : "Looking for you…"),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const metres = here ? Math.round(haversineM(here, { lat, lng })) : null;
  const inRange = metres != null && metres <= radiusM;

  return (
    <div className="border border-black/10 px-4 py-4 space-y-2">
      <p className="font-display text-lg text-fog">
        {metres == null ? "Find it" : line(metres)}
      </p>
      {inRange ? (
        <p className="text-sm text-fog">You're here. Check in, then hold.</p>
      ) : metres != null ? (
        <p className="text-sm text-mute">Get closer to unlock.</p>
      ) : null}
      {msg ? <p className="text-xs text-mute">{msg}</p> : null}
      <div className="flex flex-wrap gap-3 text-sm">
        <a href={mapsWalkUrl(lat, lng)} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center">
          Google Maps
        </a>
        <a href={appleWalkUrl(lat, lng)} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center">
          Apple Maps
        </a>
      </div>
    </div>
  );
}
