import { createAdminClient } from "@/lib/supabase/admin";
import { isPushSendReady, vapidPrivateKey, vapidPublicKey } from "@/lib/push/config";
import webpush from "web-push";

/**
 * Best ROI ping: people who already verified an action with this brand.
 * Not a cold blast. No-op without service role + VAPID.
 */
export async function notifyBrandWalkers(opts: {
  orgId: string;
  campaignId: string;
  title: string;
}): Promise<{ sent: number; reason?: string }> {
  if (!isPushSendReady()) return { sent: 0, reason: "vapid_not_configured" };
  const admin = createAdminClient();
  if (!admin) return { sent: 0, reason: "no_service_role" };

  const { data: prior } = await admin
    .from("interaction_events")
    .select("consumer_id, campaign_id")
    .not("consumer_id", "is", null)
    .limit(2000);

  const campaignIds = Array.from(
    new Set((prior ?? []).map((r) => r.campaign_id).filter(Boolean))
  ) as string[];
  if (campaignIds.length === 0) return { sent: 0, reason: "no_history" };

  const { data: branded } = await admin
    .from("campaigns")
    .select("id")
    .eq("org_id", opts.orgId)
    .in("id", campaignIds.slice(0, 200));

  const mine = new Set((branded ?? []).map((c) => c.id));
  const userIds = Array.from(
    new Set(
      (prior ?? [])
        .filter((r) => r.campaign_id && mine.has(r.campaign_id))
        .map((r) => r.consumer_id as string)
    )
  ).slice(0, 200);

  if (userIds.length === 0) return { sent: 0, reason: "no_walkers" };

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs?.length) return { sent: 0, reason: "no_subscriptions" };

  const pub = vapidPublicKey();
  const priv = vapidPrivateKey();
  if (!pub || !priv) return { sent: 0, reason: "vapid_not_configured" };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:noreply@unlock.app",
    pub,
    priv
  );

  const body = JSON.stringify({
    title: "Something is waiting",
    body: opts.title,
    url: `/campaign/${opts.campaignId}`,
    tag: `live:${opts.campaignId}`
  });

  let sent = 0;
  for (const row of subs) {
    if (!row.endpoint || !row.p256dh || !row.auth) continue;
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        body
      );
      sent += 1;
    } catch {
      /* expired endpoint */
    }
  }
  return { sent };
}
