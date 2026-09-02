"use client";

import { useState } from "react";
import { requestWithdrawalAction } from "@/lib/actions/finance";
import { formatMoney } from "@/lib/finance/money";

export function WithdrawalForm({ availableCents }: { availableCents: number }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(false);

    const major = parseFloat(amount);
    if (isNaN(major) || major <= 0) {
      setError("Enter a valid amount");
      setLoading(false);
      return;
    }

    const cents = Math.round(major * 100);
    if (cents > availableCents) {
      setError(`Insufficient available balance (${formatMoney(availableCents)})`);
      setLoading(false);
      return;
    }

    const result = await requestWithdrawalAction(cents);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setOk(true);
    setAmount("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-sm">
      <label className="block">
        <span className="font-mono text-[10px] text-mute">
          Amount (ZAR) — available {formatMoney(availableCents)}
        </span>
        <input
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full bg-ink border border-white/10 px-3 py-2 text-fog font-mono text-sm focus:border-volt outline-none"
        />
      </label>
      {error && <p className="text-magenta font-mono text-xs">{error}</p>}
      {ok && (
        <p className="text-volt font-mono text-xs">
          Withdrawal requested. Status: requested → processing → paid.
        </p>
      )}
      <button
        type="submit"
        disabled={loading || availableCents <= 0}
        className="clip-keyhole-sm bg-volt text-ink font-display text-sm px-5 py-2 disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Request withdrawal"}
      </button>
    </form>
  );
}
