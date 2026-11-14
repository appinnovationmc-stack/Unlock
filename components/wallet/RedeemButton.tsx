"use client";
import { useState, useTransition } from "react";
import { prepareRedemption } from "@/lib/actions/rewards";

export function RedeemButton({ claimId }: { claimId: string; campaignId?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return <div className="text-right max-w-xs">
    <button type="button" disabled={pending} onClick={() => startTransition(async () => {
      setError(null);
      const result = await prepareRedemption(claimId);
      if (result.error) setError(result.error); else setToken(result.token!);
    })} className="font-mono text-xs text-volt border border-white/20 px-3 py-2 disabled:opacity-50">
      {pending ? "Preparing…" : "Show merchant token"}
    </button>
    {token && <div className="mt-2 text-sm"><p>Show this to the merchant. Valid for 10 minutes; your reward stays available until the merchant confirms.</p><code className="block break-all select-all text-volt">{token}</code></div>}
    {error && <p role="alert" className="text-magenta text-xs mt-1">{error}</p>}
  </div>;
}
