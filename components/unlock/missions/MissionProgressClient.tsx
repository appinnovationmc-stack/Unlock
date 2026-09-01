"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Soft-refresh mission progress after location/unlock actions on the same page. */
export function MissionProgressRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
