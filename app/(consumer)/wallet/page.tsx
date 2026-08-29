import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { XPBadge } from "@/components/ui/XPBadge";

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
        <h1 className="font-display text-2xl text-fog mb-4">Wallet</h1>
        <p className="text-mute text-sm">
          Wallet is for consumer accounts. Switch to a consumer account to collect and redeem
          rewards.
        </p>
      </main>
    );
  }

  const { data: claims } = await supabase
    .from("reward_claims")
    .select("*, rewards(label, value, type)")
    .eq("consumer_id", user.id)
    .order("claimed_at", { ascending: false });

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-magenta">Wallet</p>
          <h1 className="font-display text-2xl text-fog mt-1">@{consumer.handle}</h1>
        </div>
        <XPBadge xp={consumer.xp} />
      </header>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">XP</p>
          <p className="font-display text-2xl text-volt mt-1">{consumer.xp}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Balance</p>
          <p className="font-display text-2xl text-gold mt-1">
            R{(consumer.wallet_balance_cents / 100).toFixed(2)}
          </p>
        </div>
      </div>

      <h2 className="font-display text-lg text-fog mb-4">Your rewards</h2>
      <div className="border border-white/5 divide-y divide-white/5">
        {!claims || claims.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-mute font-mono text-sm mb-3">No rewards yet.</p>
            <Link href="/discover" className="text-volt font-mono text-xs uppercase tracking-widest">
              Discover campaigns →
            </Link>
          </div>
        ) : (
          claims.map((claim: any) => (
            <div key={claim.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-display text-fog">
                  {claim.rewards?.label ?? "Reward"}
                </p>
                <p className="font-mono text-xs text-mute mt-0.5">
                  {claim.rewards?.value}
                  {claim.rewards?.type ? ` · ${claim.rewards.type}` : ""}
                </p>
              </div>
              <span
                className={`font-mono text-[10px] uppercase tracking-widest ${
                  claim.status === "claimed"
                    ? "text-volt"
                    : claim.status === "redeemed"
                      ? "text-gold"
                      : claim.status === "expired"
                        ? "text-mute"
                        : "text-fog"
                }`}
              >
                {claim.status}
              </span>
            </div>
          ))
        )}
      </div>

      <p className="mt-8 text-center font-mono text-[10px] text-mute uppercase tracking-widest">
        Rewards are validated server-side. Duplicate claims are blocked.
      </p>
    </main>
  );
}
