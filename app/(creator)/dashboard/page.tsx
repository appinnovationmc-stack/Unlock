import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CreatorDashboard() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: creator } = await supabase
    .from("creators")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!creator) redirect("/signup");

  const { count: referralCount } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .or(`referrer_creator_id.eq.${user.id}`)
    .eq("converted", true);

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title")
    .eq("status", "live")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-magenta">Creator</p>
        <h1 className="font-display text-2xl text-fog mt-1">@{creator.handle}</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Earnings</p>
          <p className="font-display text-2xl text-gold mt-1">R{(creator.earnings_cents / 100).toFixed(2)}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Referral conversions</p>
          <p className="font-display text-2xl text-fog mt-1">{referralCount ?? 0}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">Audience reached</p>
          <p className="font-display text-2xl text-fog mt-1">{creator.audience_size ?? "—"}</p>
        </div>
      </div>

      <h2 className="font-display text-lg text-fog mb-4">Available campaigns</h2>
      <div className="border border-white/5 divide-y divide-white/5">
        {!campaigns || campaigns.length === 0 ? (
          <p className="p-5 text-mute font-mono text-sm">No live campaigns to join right now.</p>
        ) : (
          campaigns.map((c) => (
            <a key={c.id} href={`/campaign/${c.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-ink2">
              <p className="font-display text-fog">{c.title}</p>
              <span className="font-mono text-xs text-volt">View campaign →</span>
            </a>
          ))
        )}
      </div>
    </main>
  );
}
