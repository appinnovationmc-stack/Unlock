import Link from "next/link";

export interface LiveStats {
  participating: number; interactions: number; store_visits: number;
  product_scans: number; rewards: number; redemptions: number; conversions: number;
}
export interface CreatorImpactRow {
  creator_id: string; handle?: string; impact: number;
  interactions: number; visits: number; conversions: number;
}

export function LiveCommandCentre({ campaignTitle, campaignId, status, stats, creators = [] }: {
  campaignTitle: string; campaignId: string; status: string; stats: LiveStats; creators?: CreatorImpactRow[];
}) {
  const metric = (label: string, value: number, accent?: string) => (
    <div className="border border-white/8 bg-ink2/80 px-5 py-4 clip-keyhole-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-mute">{label}</p>
      <p className={`font-display text-3xl mt-1 tabular-nums ${accent ?? "text-fog"}`}>{value.toLocaleString()}</p>
    </div>
  );
  const funnel = [
    { stage: "DISCOVER", count: stats.interactions }, { stage: "INTERACT", count: stats.interactions },
    { stage: "VISIT", count: stats.store_visits }, { stage: "UNLOCK", count: stats.rewards },
    { stage: "REDEEM", count: stats.redemptions }, { stage: "CONVERT", count: stats.conversions }
  ];
  return (
    <div className="space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`inline-flex h-2 w-2 rounded-full ${status === "live" ? "bg-volt animate-pulse" : "bg-mute"}`} />
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-volt">UNLOCK LIVE</p>
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-fog">{campaignTitle}</h1>
        </div>
        <Link href="/studio" className="font-mono text-[10px] uppercase tracking-widest text-mute border border-white/10 px-3 py-1.5 hover:text-volt">Studio</Link>
      </header>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {metric("People", stats.participating, "text-volt")}
        {metric("Interactions", stats.interactions)}
        {metric("Store visits", stats.store_visits, "text-volt")}
        {metric("Product scans", stats.product_scans)}
        {metric("Rewards", stats.rewards, "text-gold")}
        {metric("Redeemed", stats.redemptions, "text-gold")}
        {metric("Conversions", stats.conversions, "text-magenta")}
      </section>
      <section className="border border-white/8 bg-ink2/50 p-6 clip-keyhole">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-mute mb-6">Funnel</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
          {funnel.map((s, i) => (
            <div key={s.stage} className="flex items-center gap-2 sm:flex-1">
              <div className="flex-1 text-center py-3 border border-white/10 bg-void/60">
                <p className="font-mono text-[9px] uppercase tracking-widest text-mute">{s.stage}</p>
                <p className="font-display text-xl text-fog tabular-nums">{s.count.toLocaleString()}</p>
              </div>
              {i < funnel.length - 1 && <span className="hidden sm:block text-mute px-1">→</span>}
            </div>
          ))}
        </div>
      </section>
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-mute mb-4">Top Impact</p>
        {creators.length === 0 ? (
          <p className="text-mute text-sm font-mono">No creator attribution yet.</p>
        ) : (
          <div className="space-y-2">
            {creators.slice(0, 8).map((c, i) => (
              <div key={c.creator_id} className="flex items-center justify-between border border-white/8 bg-ink2/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-mute w-6">{i + 1}.</span>
                  <span className="font-display text-fog">{c.handle ?? c.creator_id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-6 font-mono text-xs tabular-nums">
                  <span className="text-volt">{c.impact.toLocaleString()} Impact</span>
                  <span className="text-mute hidden sm:inline">{c.visits} visits</span>
                  <span className="text-magenta">{c.conversions} conv.</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
