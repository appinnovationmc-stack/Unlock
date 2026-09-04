"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HuntPulse } from "./HuntPulse";
import { ReactFire } from "./ReactFire";
import { Comments } from "./Comments";
import { ShareUnlock } from "./ShareUnlock";

type Pulse = {
  hunting: number;
  unlocked: number;
  reactions: number;
  comments: number;
  last_unlock_at: string | null;
};

export function SocialRail({
  campaignId,
  userId,
  title,
  endsAt
}: {
  campaignId: string;
  userId: string | null;
  title: string;
  endsAt?: string | null;
}) {
  const [pulse, setPulse] = useState<Pulse>({
    hunting: 0,
    unlocked: 0,
    reactions: 0,
    comments: 0,
    last_unlock_at: null
  });
  const [reacted, setReacted] = useState(false);
  const [comments, setComments] = useState<
    { id: string; body: string; created_at: string; user_id: string }[]
  >([]);
  const [posts, setPosts] = useState<{ id: string; caption: string | null; photo_url: string | null }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: pulseRow } = await supabase.rpc("get_campaign_pulse", {
        p_campaign_id: campaignId
      });
      const row = Array.isArray(pulseRow) ? pulseRow[0] : pulseRow;
      if (row) setPulse((p) => ({ ...p, ...row }));

      const { data: c } = await supabase
        .from("experience_comments")
        .select("id, body, created_at, user_id")
        .eq("campaign_id", campaignId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (c) setComments(c);

      const { data: p } = await supabase
        .from("experience_posts")
        .select("id, caption, photo_url")
        .eq("campaign_id", campaignId)
        .is("hidden_at", null)
        .order("created_at", { ascending: false })
        .limit(8);
      if (p) setPosts(p);

      if (userId) {
        const { data: mine } = await supabase
          .from("experience_reactions")
          .select("kind")
          .eq("campaign_id", campaignId)
          .eq("user_id", userId)
          .eq("kind", "fire")
          .maybeSingle();
        setReacted(!!mine);
      }
    })();
  }, [campaignId, userId]);

  return (
    <div className="space-y-8 mt-8">
      <HuntPulse
        hunting={pulse.hunting}
        unlocked={pulse.unlocked}
        lastUnlockAt={pulse.last_unlock_at}
        endsAt={endsAt}
      />
      <ReactFire
        campaignId={campaignId}
        userId={userId}
        initialCount={pulse.reactions}
        initiallyOn={reacted}
      />
      <ShareUnlock campaignId={campaignId} userId={userId} title={title} />
      {posts.length > 0 ? (
        <section className="space-y-3">
          <p className="section-kicker">From people who found it</p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {posts.map((post) => (
              <li key={post.id} className="border border-black/10 p-3">
                {post.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.photo_url} alt="" className="w-full h-40 object-cover mb-2" />
                ) : null}
                <p className="text-sm text-fog">{post.caption}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Comments campaignId={campaignId} userId={userId} initial={comments} />
    </div>
  );
}
