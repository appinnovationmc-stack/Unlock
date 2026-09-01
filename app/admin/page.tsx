import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/actions/auth";
import { getPlatformRevenueSummary } from "@/lib/actions/finance";
import { formatMoney } from "@/lib/finance/money";
import { WithdrawalActions } from "./WithdrawalActions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Server-side: admin_users table only (not user_metadata)
  const role = await getCurrentRole();
  if (role !== "admin") {
    return (
      <main className="min-h-screen px-6 py-10 md:px-12">
        <h1 className="font-display text-2xl text-fog mb-4">Admin</h1>
        <p className="text-mute text-sm">
          Platform administration is restricted. Admins are granted via the{" "}
          <code className="text-volt">admin_users</code> table (service role only — not
          user_metadata).
        </p>
      </main>
    );
  }

  const { count: orgCount } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true });
  const { count: campaignCount } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true });
  const { count: consumerCount } = await supabase
    .from("consumers")
    .select("id", { count: "exact", head: true });

  let interactionCount = 0;
  let impactSum = 0;
  try {
    const { count: ic } = await supabase.from("interaction_events").select("id", { count: "exact", head: true });
    interactionCount = ic ?? 0;
    const { data: scores } = await supabase.from("impact_scores").select("total_impact");
    impactSum = (scores ?? []).reduce((a: number, s: any) => a + Number(s.total_impact ?? 0), 0);
  } catch { /* migration may not be applied */ }
  const { count: creatorCount } = await supabase
    .from("creators")
    .select("id", { count: "exact", head: true });
  const { count: eventCount } = await supabase
    .from("attribution_events")
    .select("id", { count: "exact", head: true });
  const { count: withdrawalCount } = await supabase
    .from("creator_withdrawals")
    .select("id", { count: "exact", head: true })
    .in("status", ["requested", "processing"]);

  const revenue = await getPlatformRevenueSummary();

  const { data: recentCampaigns } = await supabase
    .from("campaigns")
    .select("id, title, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: pendingWithdrawals } = await supabase
    .from("creator_withdrawals")
    .select("id, amount_cents, status, requested_at, creator_id, payout_destination_masked, creators(handle)")
    .in("status", ["requested", "processing"])
    .order("requested_at", { ascending: false })
    .limit(20);

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-magenta">Platform</p>
        <h1 className="font-display text-3xl text-fog mt-1">Admin console</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        {[
          ["Organisations", orgCount],
          ["Campaigns", campaignCount],
          ["Consumers", consumerCount],
          ["Creators", creatorCount],
          ["Events", eventCount],
          ["Payout queue", withdrawalCount]
        ].map(([label, value]) => (
          <div key={String(label)} className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">{label}</p>
            <p className="font-display text-2xl text-fog mt-1">{value ?? 0}</p>
          </div>
        ))}
      </div>

      {"platformRevenueCents" in revenue && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Platform fees</p>
            <p className="font-display text-xl text-volt mt-1">
              {formatMoney(revenue.platformRevenueCents ?? 0)}
            </p>
          </div>
          <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Deposits</p>
            <p className="font-display text-xl text-fog mt-1">
              {formatMoney(revenue.depositsCents ?? 0)}
            </p>
          </div>
          <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Creator payouts</p>
            <p className="font-display text-xl text-fog mt-1">
              {formatMoney(revenue.creatorPayoutsCents ?? 0)}
            </p>
          </div>
          <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Campaign volume</p>
            <p className="font-display text-xl text-fog mt-1">
              {formatMoney(revenue.grossCampaignVolumeCents ?? 0)}
            </p>
          </div>
        </div>
      )}

      <h2 className="font-display text-lg text-fog mb-4">Withdrawal queue</h2>
      <div className="border border-white/5 divide-y divide-white/5 mb-10">
        {(pendingWithdrawals ?? []).map((w: any) => (
          <div key={w.id} className="flex items-center justify-between px-5 py-3 gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs text-fog truncate">
                {w.creators?.handle ?? w.creator_id}
              </p>
              {w.payout_destination_masked && (
                <p className="font-mono text-[10px] text-mute truncate">{w.payout_destination_masked}</p>
              )}
            </div>
            <span className="font-display text-fog shrink-0">{formatMoney(w.amount_cents)}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-mute shrink-0">{w.status}</span>
            <div className="shrink-0">
              <section className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-white/8 bg-ink2 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Interaction events</p>
          <p className="font-display text-2xl text-volt tabular-nums">{interactionCount.toLocaleString()}</p>
        </div>
        <div className="border border-white/8 bg-ink2 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Total Impact awarded</p>
          <p className="font-display text-2xl text-fog tabular-nums">{impactSum.toLocaleString()}</p>
        </div>
      </section>

      <WithdrawalActions withdrawalId={w.id} status={w.status} />
            </div>
          </div>
        ))}
        {(!pendingWithdrawals || pendingWithdrawals.length === 0) && (
          <p className="p-5 text-mute font-mono text-sm">No pending withdrawals.</p>
        )}
      </div>

      <h2 className="font-display text-lg text-fog mb-4">Recent campaigns</h2>
      <div className="border border-white/5 divide-y divide-white/5">
        {(recentCampaigns ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between px-5 py-3">
            <p className="font-display text-fog">{c.title}</p>
            <span className="font-mono text-xs uppercase tracking-widest text-mute">{c.status}</span>
          </div>
        ))}
        {(!recentCampaigns || recentCampaigns.length === 0) && (
          <p className="p-5 text-mute font-mono text-sm">No campaigns yet.</p>
        )}
      </div>
    </main>
  );
}
