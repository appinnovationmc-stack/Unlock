"use client";

import { useState } from "react";
import { initiateBrandDeposit } from "@/lib/actions/finance";

export function DepositForm({ orgId }: { orgId: string }) {
  const [amount, setAmount] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const major = parseFloat(amount);
    if (isNaN(major) || major <= 0) {
      setError("Enter a valid amount");
      setLoading(false);
      return;
    }

    const amountCents = Math.round(major * 100);
    const result = await initiateBrandDeposit({
      orgId,
      amountCents,
      purpose: "top_up"
    });

    setLoading(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (result.authorizationUrl) {
      if (result.isSandbox) {
        setInfo("Sandbox mode — completing test payment…");
      }
      window.location.href = result.authorizationUrl;
      return;
    }

    setError("No payment URL returned");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-widest text-mute">Amount (ZAR)</span>
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
      {info && <p className="text-gold font-mono text-xs">{info}</p>}
      <button
        type="submit"
        disabled={loading}
        className="clip-keyhole-sm bg-volt text-ink font-display text-sm px-5 py-2 disabled:opacity-50"
      >
        {loading ? "Starting…" : "Deposit"}
      </button>
    </form>
  );
}
