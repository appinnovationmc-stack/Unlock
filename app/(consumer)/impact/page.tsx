import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ImpactLeaderboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let rows: { user_id: string; total_impact: number; verified_interactions: number; store_visits: number; conversions: number }[] = [];
  try {
    const { data } = await supabase
      .from("impact_scores")
      .select("user_id, total_impact, verified_interactions, store_visits, conversions")
      .order("total_impact", { ascending: false })
      .limit(50);
    rows = data ?? [];
  } catch {
    rows = [];
  }

  // Resolve handles from consumers / creators
  const ids = rows.map((r) => r.user_id);
  const handleMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: consumers } = await supabase.from("consumers").select("id, handle").in("id", ids);
    for (const c of consumers ?? []) handleMap.set(c.id, c.handle);
    const { data: creators } = await supabase.from("creators").select("id, handle").in("id", ids);
    for (const c of creators ?? []) handleMap.set(c.id, c.handle);
  }

  let myRank: number | null = null;
  let myImpact = 0;
  if (user) {
    const idx = rows.findIndex((r) => r.user_id === user.id);
    if (idx >= 0) {
      myRank = idx + 1;
      myImpact = rows[idx].total_impact;
    } else {
      try {
        const { data: mine } = await supabase.from("impact_scores").select("total_impact").eq("user_id", user.id).maybeSingle();
        myImpact = mine?.total_impact ?? 0;
      } catch { /* */ }
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-2xl mx-auto bg-void">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-volt mb-2">Impact</p>
        <h1 className="font-display text-3xl md:text-4xl text-fog">Most impactful</h1>
        <p className="text-mute text-sm mt-2">
          Ranked by verified actions — not followers.
        </p>
        {user && (
          <p className="mt-4 font-mono text-xs text-mute">
            You: <span className="text-volt">{myImpact.toLocaleString()} Impact</span>
            {myRank ? <> · Rank #{myRank}</> : null}
          </p>
        )}
      </header>

      {rows.length === 0 ? (
        <div className="border border-white/8 bg-ink2/50 px-6 py-12 text-center clip-keyhole">
          <p className="font-display text-fog mb-2">No Impact yet</p>
          <p className="text-mute font-mono text-sm mb-6">
            Complete experiences to earn Impact. Apply migration 00000018 if scores stay empty.
          </p>
          <Link href="/discover" className="font-mono text-xs uppercase tracking-widest text-volt border border-volt/40 px-4 py-2 hover:bg-volt/10">
            Open the field
          </Link>
        </div>
      ) : (
        <div className="border border-white/8 divide-y divide-white/5">
          {rows.map((r, i) => {
            const isMe = user?.id === r.user_id;
            return (
              <div
                key={r.user_id}
                className={`flex items-center justify-between px-4 py-3 ${isMe ? "bg-volt/5" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-mute w-8 shrink-0">
                    {i === 0 ? "1" : i === 1 ? "2" : i === 2 ? "3" : `${i + 1}`}
                  </span>
                  <span className={`font-display truncate ${isMe ? "text-volt" : "text-fog"}`}>
                    {handleMap.get(r.user_id) ?? r.user_id.slice(0, 8)}
                    {isMe ? " (you)" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs tabular-nums shrink-0">
                  <span className="text-volt">{r.total_impact.toLocaleString()}</span>
                  <span className="text-mute hidden sm:inline">{r.store_visits} visits</span>
                  <span className="text-magenta hidden md:inline">{r.conversions} conv</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 flex justify-center gap-6 font-mono text-[10px] uppercase tracking-widest">
        <Link href="/discover" className="text-mute hover:text-volt">Field</Link>
        <Link href="/wallet" className="text-mute hover:text-volt">Wallet</Link>
      </div>
    </main>
  );
}
