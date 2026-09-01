"use client";

import dynamic from "next/dynamic";
import type { MapPin } from "./LiveMap";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-ink2">
      <p className="font-mono text-xs text-mute tracking-widest uppercase">Loading map…</p>
    </div>
  )
});

export function LiveMapSection({ pins }: { pins: MapPin[] }) {
  return <LiveMap pins={pins} />;
}
