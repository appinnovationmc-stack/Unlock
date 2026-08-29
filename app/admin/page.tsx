import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (role !== "admin") {
    return (
      <main className="min-h-screen px-6 py-10 md:px-12">
        <h1 className="font-display text-2xl text-fog mb-4">Admin</h1>
        <p className="text-mute text-sm">
          Platform administration is restricted. Grant access by inserting the operator&apos;s
          user id into <code className="text-volt">admin_users</code> from the Supabase dashboard
          (service role only — this cannot be self-granted from the app).
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
  const { count: creatorCount } = await supabase
    .from("creators")
    .select("id", { count: "exact", head: true });
  const { count: eventCount } = await supabase
    .from("attribution_events")
    .select("id", { count: "exact", head: true });

  const { data: recentCampaigns } = await supabase
    .from("campaigns")
    .select("id, title, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-magenta">Platform</p>
        <h1 className="font-display text-3xl text-fog mt-1">Admin console</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {[
          ["Organisations", orgCount],
          ["Campaigns", campaignCount],
          ["Consumers", consumerCount],
          ["Creators", creatorCount],
          ["Events", eventCount]
        ].map(([label, value]) => (
          <div key={String(label)} className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">{label}</p>
            <p className="font-display text-2xl text-fog mt-1">{value ?? 0}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display text-lg text-fog mb-4">Recent campaigns</h2>
      <div className="border border-white/5 divide-y divide-white/5">
        {(recentCampaigns ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between px-5 py-3">
            <p className="font-display text-fog">{c.title}</p>
            <span className="font-mono text-xs uppercase tracking-widest text-mute">
              {c.status}
            </span>
          </div>
        ))}
        {(!recentCampaigns || recentCampaigns.length === 0) && (
          <p className="p-5 text-mute font-mono text-sm">No campaigns yet.</p>
        )}
      </div>
    </main>
  );
}
