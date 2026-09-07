"use client";

import { RetryState } from "@/components/ui/RetryState";

export default function StudioError({ reset }: { reset: () => void }) {
  return <RetryState reset={reset} description="We couldn't load Studio. Try again." />;
}
