"use client";

import { RetryState } from "@/components/ui/RetryState";

export default function CreatorDashboardError({ reset }: { reset: () => void }) {
  return <RetryState reset={reset} description="We couldn't load your dashboard. Try again." />;
}
