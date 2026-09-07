"use client";

import { RetryState } from "@/components/ui/RetryState";

export default function WalletError({ reset }: { reset: () => void }) {
  return <RetryState reset={reset} description="We couldn't load your collection. Try again." />;
}
