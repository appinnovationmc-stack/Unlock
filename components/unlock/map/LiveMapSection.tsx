"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [auth, setAuth] = useState<"checking" | "authenticated" | "logged-out">("checking");

  useEffect(() => {
    let active = true;
    try {
      createClient().auth.getUser().then(({ data }) => {
        if (active) setAuth(data.user ? "authenticated" : "logged-out");
      }).catch(() => {
        if (active) setAuth("logged-out");
      });
    } catch {
      if (active) setAuth("logged-out");
    }
    return () => {
      active = false;
    };
  }, []);

  if (auth === "authenticated") {
    return (
      <LiveMap
        pins={pins}
        youAvatar={youAvatar}
        fallbackCenter={{ lat: -26.2041, lng: 28.0473 }}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink2 min-h-[280px] px-6 text-center">
      <div>
        <p className="text-sm text-mute">
          {auth === "checking" ? "Checking access…" : "Log in to use your location."}
        </p>
        {auth === "logged-out" ? (
          <Link
            href="/login"
            className="inline-flex items-center min-h-11 mt-3 bg-volt text-void px-4 py-2 text-sm hover:bg-volt/90"
          >
            Log in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
