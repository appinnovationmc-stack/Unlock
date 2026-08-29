import { CampaignCard } from "@/components/campaign/CampaignCard";
import { XPBadge } from "@/components/ui/XPBadge";
import { createClient } from "@/lib/supabase/server";
import type { Campaign } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "live")
    .order("created_at", { ascending: false });

  let xp = 0;
  if (user) {
    const { data: consumer } = await supabase
      .from("consumers")
      .select("xp")
      .eq("id", user.id)
      .maybeSingle();
    xp = consumer?.xp ?? 0;
  }

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 bg-duotone">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="font-display text-3xl text-fog">Discover</h1>
          <p className="text-mute text-sm mt-1">
            Campaigns you play — not scroll past.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user ? <XPBadge xp={xp} /> : null}
          {user && (
            <Link
              href="/wallet"
              className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/30 px-3 py-1.5 hover:bg-volt/10"
            >
              Wallet
            </Link>
          )}
        </div>
      </header>

      {!campaigns || campaigns.length === 0 ? (
        <div className="border border-white/5 bg-ink2/50 px-6 py-16 text-center clip-keyhole">
          <p className="font-display text-xl text-fog mb-2">Nothing live yet</p>
          <p className="text-mute font-mono text-sm mb-6 max-w-md mx-auto">
            Brands publish interactive campaigns from Studio. Check back soon or create one.
          </p>
          <Link
            href="/studio"
            className="inline-flex font-mono text-xs uppercase tracking-widest text-volt border border-volt/40 px-4 py-2 hover:bg-volt/10"
          >
            Open Brand Studio →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(campaigns as Campaign[]).map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </main>
  );
}
