import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { XPBadge } from "@/components/ui/XPBadge";
import { RedeemButton } from "@/components/wallet/RedeemButton";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: consumer } = await supabase
    .from("consumers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!consumer) {
    return (
      <main className="min-h-screen px-6 py-10 md:px-12">
        <h1 className="font-display text-2xl text-fog mb-4">Collection</h1>
        <p className="text-mute text-sm">
          Your collection is for consumer accounts. Sign up as a consumer to gather unlocks
          and rewards.
        </p>
      </main>
    );
  }

  const { data: claims } = await supabase
    .from("reward_claims")
    .select("*, rewards(label, value, type)")
    .eq("consumer_id", user.id)
    .order("claimed_at", { ascending: false });

  let impactTotal = 0;
  let impactVisits = 0;
  try {
    const { data: score } = await supabase.from("impact_scores").select("total_impact, store_visits").eq("user_id", user.id).maybeSingle();
    impactTotal = score?.total_impact ?? 0;
    impactVisits = score?.store_visits ?? 0;
  } catch { /* migration may not be applied */ }

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-magenta">Collection</p>
          <h1 className="font-display text-2xl text-fog mt-1">@{consumer.handle}</h1>
          <p className="text-mute text-xs mt-1">Proof of every encounter you finished.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/impact" className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/30 px-2 py-1 hover:bg-volt/10">Impact board</Link>
          <XPBadge xp={consumer.xp} />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="clip-keyhole-sm bg-ink2 border border-volt/20 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Impact</p>
          <p className="font-display text-2xl text-volt mt-1 tabular-nums">{impactTotal.toLocaleString()}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">XP</p>
          <p className="font-display text-2xl text-fog mt-1">{consumer.xp}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Unlocked</p>
          <p className="font-display text-2xl text-fog mt-1">{claims?.length ?? 0}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Visits</p>
          <p className="font-display text-2xl text-fog mt-1">{impactVisits}</p>
        </div>
      </div>

      <h2 className="font-display text-lg text-fog mb-4">Rewards</h2>
      <div className="border border-white/5 divide-y divide-white/5">
        {!claims || claims.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-mute font-mono text-sm mb-3">Nothing collected yet.</p>
            <Link href="/discover" className="text-volt font-mono text-xs uppercase tracking-widest">
              Enter the field →
            </Link>
          </div>
        ) : (
          claims.map(
            (claim: {
              id: string;
              status: string;
              rewards?: { label?: string; value?: string; type?: string } | null;
            }) => (
              <div key={claim.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-display text-fog truncate">
                    {claim.rewards?.label ?? "Reward"}
                  </p>
                  <p className="font-mono text-xs text-mute mt-0.5">
                    {claim.rewards?.value}
                    {claim.rewards?.type ? ` · ${claim.rewards.type}` : ""}
                  </p>
                </div>
                {claim.status === "claimed" ? (
                  <RedeemButton claimId={claim.id} campaignId={(claim as { campaign_id?: string }).campaign_id} />
                ) : (
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest shrink-0 ${
                      claim.status === "redeemed"
                        ? "text-gold"
                        : claim.status === "expired"
                          ? "text-mute"
                          : "text-fog"
                    }`}
                  >
                    {claim.status}
                  </span>
                )}
              </div>
            )
          )
        )}
      </div>

      <p className="mt-8 text-center font-mono text-[10px] text-mute uppercase tracking-widest">
        Redeem is enforced server-side. Your collection is proof — not a receipt dump.
      </p>
    </main>
  );
}
