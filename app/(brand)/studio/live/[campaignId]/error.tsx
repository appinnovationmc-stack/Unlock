"use client";

import { RetryState } from "@/components/ui/RetryState";

export default function LiveCampaignError({ reset }: { reset: () => void }) {
  return <RetryState reset={reset} description="We couldn't load live activity. Try again." />;
}
