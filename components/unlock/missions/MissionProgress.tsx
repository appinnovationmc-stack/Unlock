import { createClient } from "@/lib/supabase/server";

export async function MissionProgress({
  campaignId,
  userId
}: {
  campaignId: string;
  userId?: string | null;
}) {
  const supabase = createClient();

  let missions: { id: string; title: string; description: string | null; sort_order: number }[] = [];
  try {
    const { data } = await supabase
      .from("missions")
      .select("id, title, description, sort_order")
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: true });
    missions = data ?? [];
  } catch {
    return null;
  }

  if (missions.length === 0) return null;

  const missionIds = missions.map((m) => m.id);
  const { data: steps } = await supabase
    .from("mission_steps")
    .select("id, mission_id, title, required_event_type, sort_order")
    .in("mission_id", missionIds)
    .order("sort_order", { ascending: true });

  const progressMap = new Map<string, number>();
  if (userId) {
    const { data: progress } = await supabase
      .from("mission_progress")
      .select("mission_id, current_step, completed_at")
      .eq("user_id", userId)
      .in("mission_id", missionIds);
    for (const p of progress ?? []) {
      progressMap.set(p.mission_id, p.completed_at ? 999 : p.current_step);
    }
  }

  const stepsByMission = new Map<string, NonNullable<typeof steps>>();
  for (const s of steps ?? []) {
    const list = stepsByMission.get(s.mission_id) ?? [];
    list.push(s);
    stepsByMission.set(s.mission_id, list);
  }

  return (
    <section className="mb-8 space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt">Missions</p>
      {missions.map((m) => {
        const mSteps = stepsByMission.get(m.id) ?? [];
        const current = progressMap.get(m.id) ?? 0;
        const done = current >= 999 || (mSteps.length > 0 && current >= mSteps.length);
        return (
          <div key={m.id} className="border border-white/8 bg-ink2/50 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-display text-fog">{m.title}</p>
                {m.description && <p className="text-mute text-xs mt-1">{m.description}</p>}
              </div>
              <span className={`font-mono text-[9px] uppercase tracking-widest shrink-0 ${done ? "text-gold" : "text-mute"}`}>
                {done ? "Complete" : `${Math.min(current, mSteps.length)}/${mSteps.length || "—"}`}
              </span>
            </div>
            {mSteps.length > 0 && (
              <ol className="space-y-2">
                {mSteps.map((s, i) => {
                  const stepDone = done || i < current;
                  return (
                    <li key={s.id} className="flex items-center gap-3 font-mono text-xs">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                          stepDone ? "border-volt bg-volt/20 text-volt" : "border-white/15 text-mute"
                        }`}
                      >
                        {stepDone ? "✓" : i + 1}
                      </span>
                      <span className={stepDone ? "text-fog" : "text-mute"}>{s.title}</span>
                      <span className="text-mute/60 ml-auto hidden sm:inline">{s.required_event_type}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
    </section>
  );
}
