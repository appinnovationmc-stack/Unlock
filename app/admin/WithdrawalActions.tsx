"use client";

import { useState } from "react";
import {
  adminStartWithdrawalProcessing,
  adminCompleteWithdrawal,
  adminRejectWithdrawal
} from "@/lib/actions/finance";

export function WithdrawalActions({
  withdrawalId,
  status
}: {
  withdrawalId: string;
  status: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(status);

  async function run(action: () => Promise<{ error?: string; success?: boolean }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
  }

  if (localStatus === "paid" || localStatus === "rejected") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-mute">{localStatus}</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="font-mono text-[10px] text-magenta">{error}</span>}
      {localStatus === "requested" && (
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await adminStartWithdrawalProcessing(withdrawalId);
              if (!r.error) setLocalStatus("processing");
              return r;
            })
          }
          className="font-mono text-[10px] uppercase tracking-widest text-gold border border-gold/40 px-2 py-1 hover:bg-gold/10 disabled:opacity-50"
        >
          Start processing
        </button>
      )}
      {(localStatus === "requested" || localStatus === "processing") && (
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const providerReference = window.prompt("Provider reference (optional):") || undefined;
              const r = await adminCompleteWithdrawal(withdrawalId, providerReference);
              if (!r.error) setLocalStatus("paid");
              return r;
            })
          }
          className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/40 px-2 py-1 hover:bg-volt/10 disabled:opacity-50"
        >
          Mark paid
        </button>
      )}
      {(localStatus === "requested" || localStatus === "processing") && (
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const reason = window.prompt("Rejection reason (optional):") || undefined;
              const r = await adminRejectWithdrawal(withdrawalId, reason);
              if (!r.error) setLocalStatus("rejected");
              return r;
            })
          }
          className="font-mono text-[10px] uppercase tracking-widest text-magenta border border-magenta/40 px-2 py-1 hover:bg-magenta/10 disabled:opacity-50"
        >
          Reject
        </button>
      )}
    </div>
  );
}
