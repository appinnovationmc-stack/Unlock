"use client";

import { useState } from "react";
import { fundCampaignBudgetAction } from "@/lib/actions/finance";

export function FundCampaignForm({
  campaigns
}: {
  campaigns: { id: string; title: string; status: string }[];
}) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || "");
  const [total, setTotal] = useState("10000");
  const [creatorAlloc, setCreatorAlloc] = useState("4000");
  const [rewardAlloc, setRewardAlloc] = useState("2000");
  const [perfAlloc, setPerfAlloc] = useState("2500");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(false);

    const totalCents = Math.round(parseFloat(total) * 100);
    const creatorCents = Math.round(parseFloat(creatorAlloc || "0") * 100);
    const rewardCents = Math.round(parseFloat(rewardAlloc || "0") * 100);
    const perfCents = Math.round(parseFloat(perfAlloc || "0") * 100);

    if (!campaignId || isNaN(totalCents) || totalCents <= 0) {
      setError("Select a campaign and enter a positive budget");
      setLoading(false);
      return;
    }

    const result = await fundCampaignBudgetAction({
      campaignId,
      totalBudgetCents: totalCents,
      creatorAllocationCents: creatorCents,
      rewardAllocationCents: rewardCents,
      performanceAllocationCents: perfCents
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOk(true);
  }

  if (campaigns.length === 0) {
    return (
      <p className="text-mute font-mono text-xs">
        No unfunded campaigns. Create a new campaign in Studio, or check the Campaign budgets
        section below — each campaign can only be funded once.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-widest text-mute">Campaign</span>
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="mt-1 w-full bg-ink border border-white/10 px-3 py-2 text-fog font-mono text-sm focus:border-volt outline-none"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.status})
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-widest text-mute">
          Total budget (ZAR)
        </span>
        <input
          type="number"
          min="1"
          step="0.01"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          className="mt-1 w-full bg-ink border border-white/10 px-3 py-2 text-fog font-mono text-sm focus:border-volt outline-none"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="font-mono text-[10px] text-mute">Creators</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={creatorAlloc}
            onChange={(e) => setCreatorAlloc(e.target.value)}
            className="mt-1 w-full bg-ink border border-white/10 px-2 py-1.5 text-fog font-mono text-xs"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-mute">Rewards</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={rewardAlloc}
            onChange={(e) => setRewardAlloc(e.target.value)}
            className="mt-1 w-full bg-ink border border-white/10 px-2 py-1.5 text-fog font-mono text-xs"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-mute">Performance</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={perfAlloc}
            onChange={(e) => setPerfAlloc(e.target.value)}
            className="mt-1 w-full bg-ink border border-white/10 px-2 py-1.5 text-fog font-mono text-xs"
          />
        </label>
      </div>
      <p className="font-mono text-[10px] text-mute">
        Platform fee is calculated automatically from your commercial rule (default 15%). Allocations
        must not exceed total.
      </p>
      {error && <p className="text-magenta font-mono text-xs">{error}</p>}
      {ok && <p className="text-volt font-mono text-xs">Campaign funded.</p>}
      <button
        type="submit"
        disabled={loading}
        className="clip-keyhole-sm bg-volt text-ink font-display text-sm px-5 py-2 disabled:opacity-50"
      >
        {loading ? "Funding…" : "Fund campaign"}
      </button>
    </form>
  );
}
