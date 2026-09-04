import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/activity");

  const { data: rows } = await supabase
    .from("user_notifications")
    .select("id, kind, body, campaign_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main className="page-shell min-h-screen">
      <h1 className="font-display text-3xl text-fog mb-2">Activity</h1>
      <p className="text-mute text-sm mb-8">People you follow. Not a public GPS feed.</p>
      {!rows || rows.length === 0 ? (
        <p className="text-mute text-sm">Quiet. Follow someone, then their notes land here.</p>
      ) : (
        <ul className="divide-y divide-black/10 border border-black/10">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm flex justify-between gap-3">
              <span className="text-fog">{r.body}</span>
              {r.campaign_id ? (
                <Link href={`/campaign/${r.campaign_id}`} className="text-mute shrink-0">
                  Open
                </Link>
              ) : (
                <span className="text-mute shrink-0">{new Date(r.created_at).toLocaleString()}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
