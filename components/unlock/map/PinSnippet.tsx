"use client";

import Link from "next/link";
import type { MapPin } from "./LiveMap";

function safeHttp(url?: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return url;
  } catch {
    /* */
  }
  return null;
}

function distanceLine(m: number | null | undefined) {
  if (m == null || !Number.isFinite(m)) return null;
  if (m < 25) return "You're here";
  if (m < 1000) return `${Math.round(m)} m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

export function PinSnippet({
  pin,
  distanceM,
  onClose
}: {
  pin: MapPin;
  distanceM?: number | null;
  onClose: () => void;
}) {
  const logo = safeHttp(pin.logo_url);
  const name = pin.brand_name || pin.campaign_title;
  const place = pin.label && pin.label !== pin.campaign_title ? pin.label : null;
  const howFar = distanceLine(distanceM ?? null);

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 p-4 pointer-events-none"
      role="dialog"
      aria-label={name}
    >
      <div className="unlock-glass pointer-events-auto mx-auto max-w-sm p-4">
        <div className="flex items-start gap-3">
          {logo ? (
            <img
              src={logo}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover bg-ink shrink-0"
            />
          ) : (
            <span className="h-12 w-12 rounded-full bg-volt text-white font-display flex items-center justify-center shrink-0">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg text-fog truncate">{name}</p>
            {place ? <p className="text-sm text-mute truncate">{place}</p> : null}
            <p className="text-sm text-mute mt-2">
              {howFar ? howFar : "Find it. Get close. Unlock it."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-mute text-sm min-h-11 min-w-11"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <Link
          href={`/campaign/${pin.campaign_id}`}
          className="mt-4 flex min-h-11 items-center justify-center rounded-full bg-volt text-white text-sm"
        >
          Go there
        </Link>
      </div>
    </div>
  );
}
