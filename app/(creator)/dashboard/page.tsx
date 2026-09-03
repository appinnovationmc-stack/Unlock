import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/finance/money";
import { CopyReferralLink } from "@/components/creator/CopyReferralLink";

export const dynamic = "force-dynamic";

export default async function CreatorDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: creator } = await supabase.from("creators").select("*").eq("id", user.id).maybeSingle();
  if (!creator) redirect("/signup");

  let impact = { total_impact: 0, verified_interactions: 0, store_visits: 0, conversions: 0 };
  try {
    const { data: score } = await supabase.from("impact_scores").select("*").eq("user_id", user.id).maybeSingle();
    if (score) impact = score as typeof impact;
  } catch { /* */ }

  let attributed = { interactions: 0, visits: 0, conversions: 0 };
  try {
    const { data: events } = await supabase.from("interaction_events").select("event_type")
      .eq("creator_id", user.id).eq("verification_status", "verified");
    if (events) {
      attributed = {
        interactions: events.length,
        visits: events.filter((e: any) => e.event_type === "LOCATION_CHECKIN").length,
        conversions: events.filter((e: any) => ["REFERRAL_CONVERSION","PURCHASE"].includes(e.event_type)).length
      };
    }
  } catch { /* */ }

  let recentAttributed: { event_type: string; created_at: string }[] = [];
  try {
    const { data: recent } = await supabase
      .from("interaction_events")
      .select("event_type, created_at")
      .eq("creator_id", user.id)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(6);
    recentAttributed = recent ?? [];
  } catch { /* */ }

  const { count: referralCount } = await supabase.from("referrals").select("id", { count: "exact", head: true })
    .eq("referrer_creator_id", user.id).eq("converted", true);
  const { data: campaigns } = await supabase.from("campaigns").select("id, title").eq("status", "live").order("created_at", { ascending: false });

  let wallet = { pending_cents: 0, available_cents: 0, lifetime_earned_cents: 0 };
  try {
    const { data: w } = await supabase.from("creator_wallets").select("pending_cents, available_cents, lifetime_earned_cents").eq("creator_id", user.id).maybeSingle();
    if (w) wallet = w as typeof wallet;
  } catch { /* */ }

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 bg-void">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-magenta mb-1">Creator</p>
          <h1 className="font-display text-3xl text-fog">@{creator.handle}</h1>
          <p className="text-mute text-sm mt-2 max-w-lg">Your value is measured by what you make happen — not by follower count.</p>
        </div>
        <Link href="/dashboard/wallet" className="font-mono text-[10px] uppercase tracking-widest text-gold border border-gold/30 px-3 py-1.5 hover:bg-gold/10 shrink-0">Wallet</Link>
      </header>
      <section className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt mb-4">Your Impact</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-volt/30 bg-ink2 px-5 py-5 clip-keyhole-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Total Impact</p>
            <p className="font-display text-3xl text-volt mt-1 tabular-nums">{impact.total_impact.toLocaleString()}</p>
          </div>
          <div className="border border-white/8 bg-ink2 px-5 py-5 clip-keyhole-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Verified interactions</p>
            <p className="font-display text-2xl text-fog mt-1 tabular-nums">{Math.max(impact.verified_interactions, attributed.interactions).toLocaleString()}</p>
          </div>
          <div className="border border-white/8 bg-ink2 px-5 py-5 clip-keyhole-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Store visits driven</p>
            <p className="font-display text-2xl text-fog mt-1 tabular-nums">{Math.max(impact.store_visits, attributed.visits).toLocaleString()}</p>
          </div>
          <div className="border border-white/8 bg-ink2 px-5 py-5 clip-keyhole-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Conversions</p>
            <p className="font-display text-2xl text-magenta mt-1 tabular-nums">{Math.max(impact.conversions, attributed.conversions, referralCount ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </section>
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <div className="border border-gold/20 bg-ink2 px-5 py-4 clip-keyhole-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Available</p>
          <p className="font-display text-2xl text-gold mt-1">{formatMoney(wallet.available_cents)}</p>
          <p className="font-mono text-[10px] text-mute mt-1">Pending {formatMoney(wallet.pending_cents)}</p>
        </div>
        <div className="border border-white/5 bg-ink2 px-5 py-4 clip-keyhole-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Referral conversions</p>
          <p className="font-display text-2xl text-fog mt-1">{referralCount ?? 0}</p>
        </div>
        <div className="border border-white/5 bg-ink2 px-5 py-4 clip-keyhole-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Audience (secondary)</p>
          <p className="font-display text-2xl text-mute mt-1">{creator.audience_size ?? "—"}</p>
        </div>
      </section>
      <h2 className="font-display text-lg text-fog mb-4">Live campaigns — activate</h2>
      <div className="border border-white/8 divide-y divide-white/5">
        {!campaigns || campaigns.length === 0 ? (
          <p className="p-5 text-mute font-mono text-sm">No live campaigns right now.</p>
        ) : campaigns.map((c) => (
          <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4">
            <p className="font-display text-fog">{c.title}</p>
            <div className="flex gap-3 font-mono text-xs">
              <Link href={`/campaign/${c.id}`} className="text-mute hover:text-volt">Open</Link>
              <Link href={`/campaign/${c.id}?ref=${user.id}`} className="text-volt hover:underline">Open with ref</Link>
              <CopyReferralLink href={`/campaign/${c.id}?ref=${user.id}`} />
            </div>
          </div>
        ))}
      </div>

      {recentAttributed.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-lg text-fog mb-4">Attributed activity</h2>
          <div className="border border-white/8 divide-y divide-white/5">
            {recentAttributed.map((e, i) => (
              <div key={i} className="flex justify-between px-4 py-2.5 font-mono text-xs">
                <span className="text-fog">{e.event_type}</span>
                <span className="text-mute">{new Date(e.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 mb-6 border border-white/5 bg-ink2/40 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-mute mb-2">Impact weights (platform defaults)</p>
        <p className="font-mono text-[10px] text-mute leading-relaxed">
          VIEW 1 · SHARE 5 · CHECK-IN 25 · QR/PRODUCT 15 · UNLOCK 10 · REFERRAL CONV 50 · PURCHASE 100
        </p>
      </section>
      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-mute">
        A small creator who drives 50 verified visits outperforms a famous one who drives 10.
      </p>
    </main>
  );
}
