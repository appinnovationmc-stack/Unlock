"use client";

import { RetryState } from "@/components/ui/RetryState";

export default function DiscoverError({ reset }: { reset: () => void }) {
  return <RetryState reset={reset} description="We couldn't load the field. Try again." />;
}
