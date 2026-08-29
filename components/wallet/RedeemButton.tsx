"use client";

import { useState, useTransition } from "react";
import { redeemClaim } from "@/lib/actions/rewards";

export function RedeemButton({ claimId }: { claimId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-gold">Redeemed</span>
    );
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const r = await redeemClaim(claimId);
            if (r.ok) setDone(true);
            else setError(r.error);
          });
        }}
        className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/40 px-2 py-1 hover:bg-volt/10 disabled:opacity-50"
      >
        {pending ? "…" : "Redeem"}
      </button>
      {error && <p className="text-magenta text-[10px] mt-1 max-w-[120px]">{error}</p>}
    </div>
  );
}
