import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PushOptIn } from "@/components/unlock/notifications/PushOptIn";
import { AvatarPicker } from "@/components/unlock/you/AvatarPicker";

export const dynamic = "force-dynamic";

function levelFromImpact(impact: number | null) {
  if (impact == null) return { level: null as number | null, title: "Pending" };
  if (impact >= 5000) return { level: 5, title: "Legend" };
  if (impact >= 1500) return { level: 4, title: "Operator" };
  if (impact >= 500) return { level: 3, title: "Explorer" };
  if (impact >= 100) return { level: 2, title: "Participant" };
  return { level: 1, title: "New" };
}

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: consumer } = await supabase.from("consumers").select("*").eq("id", user.id).maybeSingle();
  if (!consumer) {
    return (
      <main className="min-h-screen px-6 py-10 md:px-12 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl text-fog mb-2">You</h1>
        <p className="text-mute text-sm">Join as a participant to put yourself on the map.</p>
      </main>
    );
  }

  let impact: number | null = null;
  let visits: number | null = null;
  let verified: number | null = null;
  let impactError = false;
  try {
    const { data: score, error } = await supabase.from("impact_scores").select("*").eq("user_id", user.id).maybeSingle();
    if (error) impactError = true;
    else if (score) {
      impact = score.total_impact;
      visits = score.store_visits;
      verified = score.verified_interactions;
    }
  } catch {
    impactError = true;
  }

  const { count: unlockCount } = await supabase
    .from("campaign_participations")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", user.id)
    .not("unlocked_at", "is", null);

  const { count: rewardCount } = await supabase
    .from("reward_claims")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", user.id);

  const { level, title } = levelFromImpact(impact);
  const impactLabel = impactError ? "Unavailable" : impact == null ? "Pending" : impact.toLocaleString();

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-2xl mx-auto bg-void">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-fog">@{consumer.handle}</h1>
        <p className="text-mute text-sm mt-2">This is you on the map.</p>
      </header>
      <section className="mb-8">
        <AvatarPicker current={consumer.avatar_url} />
      </section>
      <section className="mb-8">
        <PushOptIn />
      </section>
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <div className="border border-black/10 bg-ink px-5 py-5">
          <p className="text-xs text-mute">Unlocks</p>
          <p className="font-display text-2xl text-fog mt-1">{unlockCount ?? 0}</p>
        </div>
        <div className="border border-black/10 bg-ink px-5 py-5">
          <p className="text-xs text-mute">Rewards</p>
          <p className="font-display text-2xl text-fog mt-1">{rewardCount ?? 0}</p>
        </div>
        <div className="border border-black/10 bg-ink px-5 py-5">
          <p className="text-xs text-mute">Visits</p>
          <p className="font-display text-2xl text-fog mt-1">{impactError ? "—" : visits == null ? "—" : visits}</p>
        </div>
      </section>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/wallet" className="min-h-11 flex items-center">Rewards</Link>
        <Link href="/discover" className="min-h-11 flex items-center">Explore</Link>
      </div>
    </main>
  );
}
