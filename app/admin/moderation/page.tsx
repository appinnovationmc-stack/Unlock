import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/actions/auth";
import { HideTarget } from "./HideTarget";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/moderation");
  const role = await getCurrentRole();
  if (role !== "admin") redirect("/admin");

  const { data: reports } = await supabase
    .from("content_reports")
    .select("id, target_type, target_id, reason, created_at, reporter_id")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="page-shell min-h-screen">
      <h1 className="font-display text-3xl text-fog mb-2">Moderation</h1>
      <p className="text-mute text-sm mb-8">Reports from the field. Hide is server-side.</p>
      {!reports || reports.length === 0 ? (
        <p className="text-mute text-sm">No reports.</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="border border-black/10 px-4 py-3 text-sm">
              <p className="text-fog">
                {r.target_type} · {r.reason}
              </p>
              <p className="text-mute text-xs mt-1">{r.target_id}</p>
              <HideTarget type={r.target_type} id={r.target_id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
