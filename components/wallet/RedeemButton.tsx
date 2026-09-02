"use client";

import { useState, useTransition } from "react";
import { redeemClaim } from "@/lib/actions/rewards";
import { recordInteraction } from "@/lib/unlock/interactions/record";

export function RedeemButton({
  claimId,
  campaignId
}: {
  claimId: string;
  campaignId?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="font-mono text-[10px] text-gold">Redeemed</span>;
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const r = await redeemClaim(claimId);
            if (r.ok) {
              setDone(true);
              void recordInteraction({
                eventType: "REWARD_REDEEM",
                campaignId: campaignId ?? undefined,
                verificationMethod: "authenticated_session",
                metadata: { claimId, source: "wallet_redeem" },
                idempotencyKey: `redeem:${claimId}`
              });
            } else setError(r.error);
          });
        }}
        className="font-mono text-[10px] text-volt border border-white/20 px-2 py-1 disabled:opacity-50"
      >
        {pending ? "…" : "Redeem"}
      </button>
      {error && <p className="text-magenta text-[10px] mt-1 max-w-[120px]">{error}</p>}
    </div>
  );
}
