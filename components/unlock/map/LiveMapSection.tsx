"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "./LiveMap";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-ink2 min-h-[280px]">
      <p className="text-sm text-mute">Loading map…</p>
    </div>
  )
});

export function LiveMapSection({
  pins,
  youAvatar
}: {
  pins: MapPin[];
  youAvatar?: string | null;
}) {
  return (
    <LiveMap
      pins={pins}
      youAvatar={youAvatar}
      fallbackCenter={{ lat: -26.2041, lng: 28.0473 }}
    />
  );
}
