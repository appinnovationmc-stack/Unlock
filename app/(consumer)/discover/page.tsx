import { CampaignCard } from "@/components/campaign/CampaignCard";
import { XPBadge } from "@/components/ui/XPBadge";
import { createClient } from "@/lib/supabase/server";
import type { Campaign } from "@/lib/types";

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
      <header className="flex items-center justify-between mb-10">
        <h1 className="font-display text-2xl text-fog">Discover</h1>
        {user ? <XPBadge xp={xp} /> : null}
      </header>

      {!campaigns || campaigns.length === 0 ? (
        <p className="text-mute font-mono text-sm">
          No live campaigns yet. Brands can publish one from the Studio.
        </p>
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
