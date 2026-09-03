import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PushOptIn } from "@/components/unlock/notifications/PushOptIn";
import { AvatarPicker } from "@/components/unlock/you/AvatarPicker";
import { getConsumerLedger } from "@/lib/unlock/you/ledger";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const { data: consumer } = await supabase.from("consumers").select("*").eq("id", user.id).maybeSingle();
  if (!consumer) {
    return (
      <main className="page-shell min-h-screen">
        <h1 className="font-display text-2xl text-fog mb-2">You</h1>
        <p className="text-mute text-sm">Create a participant profile, then your numbers live here.</p>
        <Link href="/signup" className="inline-block mt-4 text-sm">
          Create account
        </Link>
      </main>
    );
  }

  const ledger = await getConsumerLedger(user.id);

  return (
    <main className="page-shell min-h-screen">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-fog">@{consumer.handle}</h1>
        <p className="text-mute text-sm mt-2">Your ledger. Not a leaderboard.</p>
      </header>
      <section className="mb-8">
        <AvatarPicker current={consumer.avatar_url} />
      </section>
      <section className="mb-8">
        <PushOptIn />
      </section>
      <section className="grid grid-cols-2 gap-4 mb-10">
        <div className="border border-black/10 px-5 py-5">
          <p className="text-xs text-mute">Unlocks</p>
          <p className="font-display text-2xl text-fog mt-1">{ledger.unlocks}</p>
        </div>
        <div className="border border-black/10 px-5 py-5">
          <p className="text-xs text-mute">Rewards</p>
          <p className="font-display text-2xl text-fog mt-1">{ledger.rewards}</p>
        </div>
        <div className="border border-black/10 px-5 py-5">
          <p className="text-xs text-mute">Arrivals</p>
          <p className="font-display text-2xl text-fog mt-1">{ledger.visits}</p>
        </div>
        <div className="border border-black/10 px-5 py-5">
          <p className="text-xs text-mute">Opens</p>
          <p className="font-display text-2xl text-fog mt-1">{ledger.views}</p>
        </div>
      </section>
      <section className="mb-10">
        <h2 className="font-display text-lg text-fog mb-3">What you did</h2>
        {ledger.rows.length === 0 ? (
          <p className="text-mute text-sm">Nothing recorded yet. Walk a pin. It will show here.</p>
        ) : (
          <ul className="divide-y divide-black/10 border border-black/10">
            {ledger.rows.map((r) => (
              <li key={r.id} className="px-4 py-3 flex justify-between gap-3 text-sm">
                <span className="text-fog">{r.kind}</span>
                {r.campaignId ? (
                  <Link href={`/campaign/${r.campaignId}`} className="text-mute shrink-0">
                    Open
                  </Link>
                ) : (
                  <span className="text-mute shrink-0">{r.when}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/wallet">Rewards</Link>
        <Link href="/discover">Explore</Link>
      </div>
    </main>
  );
}
