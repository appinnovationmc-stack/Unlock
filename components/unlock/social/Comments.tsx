"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { id: string; body: string; created_at: string; user_id: string };

export function Comments({
  campaignId,
  userId,
  initial
}: {
  campaignId: string;
  userId: string | null;
  initial: Row[];
}) {
  const [rows, setRows] = useState(initial);
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [faces, setFaces] = useState<Record<string, { handle: string | null; avatar_url: string | null }>>({});

  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length === 0) return;
    const supabase = createClient();
    void supabase
      .from("consumers")
      .select("id, handle, avatar_url")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const next: Record<string, { handle: string | null; avatar_url: string | null }> = {};
        for (const c of data) next[c.id] = { handle: c.handle, avatar_url: c.avatar_url };
        setFaces(next);
      });
  }, [rows]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setMsg("Log in to leave a note.");
      return;
    }
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("experience_comments")
      .insert({ campaign_id: campaignId, user_id: userId, body: text })
      .select("id, body, created_at, user_id")
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      setMsg(error?.message ?? "Could not post.");
      return;
    }
    setRows((prev) => [data as Row, ...prev]);
    setBody("");
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("experience_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId ?? "");
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function report(id: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("content_reports").insert({
      reporter_id: userId,
      target_type: "comment",
      target_id: id,
      reason: "inappropriate"
    });
    setMsg("Reported.");
  }

  return (
    <section className="space-y-3">
      <p className="section-kicker">On the hunt</p>
      {rows.length === 0 ? <p className="text-sm text-mute">No notes yet.</p> : null}
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.id} className="text-sm flex gap-3">
            {faces[r.user_id]?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faces[r.user_id].avatar_url ?? ""}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-black/10 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs text-mute mb-1">
                {faces[r.user_id]?.handle ? `@${faces[r.user_id].handle}` : "Hunter"}
              </p>
              <p className="text-fog">{r.body}</p>
              <p className="text-mute text-xs mt-1">
                {new Date(r.created_at).toLocaleString()}
                {userId === r.user_id ? (
                  <button type="button" className="ml-3" onClick={() => remove(r.id)}>
                    Remove
                  </button>
                ) : userId ? (
                  <button type="button" className="ml-3" onClick={() => report(r.id)}>
                    Report
                  </button>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={post} className="flex flex-col gap-2">
        <label className="text-sm text-mute">
          Leave a note
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={280}
            rows={2}
            className="mt-1 block w-full border border-black/10 bg-transparent px-2 py-2 text-fog"
          />
        </label>
        <button type="submit" disabled={busy} className="min-h-11 self-start px-4 text-sm border border-black/10">
          {busy ? "Sending" : "Post"}
        </button>
      </form>
      {msg ? <p className="text-sm text-mute">{msg}</p> : null}
    </section>
  );
}
