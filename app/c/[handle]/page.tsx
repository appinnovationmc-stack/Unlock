import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PublicCreatorPage({
  params
}: {
  params: { handle: string };
}) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, "");
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_creator", { p_handle: handle });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.handle) return notFound();

  const { data: live } = await supabase
    .from("campaigns")
    .select("id, title")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <main className="page-shell min-h-screen">
      <p className="section-kicker mb-2">Creator</p>
      <h1 className="font-display text-4xl text-fog">@{row.handle}</h1>
      <p className="text-mute text-sm mt-2 max-w-lg">
        Measured by walks they caused. Not by followers.
      </p>
      <section className="grid grid-cols-2 gap-4 mt-8 mb-10">
        <div className="unlock-glass px-4 py-4">
          <p className="text-xs text-mute">Impact</p>
          <p className="font-display text-2xl text-fog mt-1 tabular-nums">
            {Number(row.total_impact ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="unlock-glass px-4 py-4">
          <p className="text-xs text-mute">Verified</p>
          <p className="font-display text-2xl text-fog mt-1 tabular-nums">
            {Number(row.verified_interactions ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="unlock-glass px-4 py-4">
          <p className="text-xs text-mute">Visits driven</p>
          <p className="font-display text-2xl text-fog mt-1 tabular-nums">
            {Number(row.store_visits ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="unlock-glass px-4 py-4">
          <p className="text-xs text-mute">Conversions</p>
          <p className="font-display text-2xl text-fog mt-1 tabular-nums">
            {Number(row.conversions ?? 0).toLocaleString()}
          </p>
        </div>
      </section>
      <h2 className="font-display text-lg text-fog mb-3">Live drops they can send</h2>
      <ul className="divide-y divide-black/10 border border-black/10">
        {!live || live.length === 0 ? (
          <li className="px-4 py-3 text-mute text-sm">Quiet field.</li>
        ) : (
          live.map((c) => (
            <li key={c.id} className="px-4 py-3 flex justify-between gap-3 text-sm">
              <span className="text-fog">{c.title}</span>
              <Link href={`/campaign/${c.id}`} className="text-mute shrink-0">
                Open
              </Link>
            </li>
          ))
        )}
      </ul>
      <p className="text-mute text-xs mt-8">No wallet. No earnings. Those stay private.</p>
    </main>
  );
}
