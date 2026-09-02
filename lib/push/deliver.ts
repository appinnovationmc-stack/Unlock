import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { isPushSendReady, vapidPrivateKey, vapidPublicKey } from "./config";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type DeliverResult =
  | { sent: true; count: number }
  | { sent: false; reason: "vapid_not_configured" }
  | { sent: false; reason: "no_subscriptions" }
  | { sent: false; reason: "send_failed" };

function vapidSubject(): string {
  const subject = process.env.VAPID_SUBJECT?.trim();
  return subject && subject.length > 0 ? subject : "mailto:noreply@unlock.app";
}

function statusCodeFromError(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    const code = (err as { statusCode?: unknown }).statusCode;
    if (typeof code === "number") return code;
  }
  return undefined;
}

/**
 * Attempt Web Push to the signed-in user's stored subscriptions.
 * Does not throw into product UI. Never reports success without a real send.
 * Without VAPID keys this returns vapid_not_configured (honest no-op).
 */
export async function deliverPushToCurrentUser(payload: PushPayload): Promise<DeliverResult> {
  try {
    if (!isPushSendReady()) {
      return { sent: false, reason: "vapid_not_configured" };
    }

    const publicKey = vapidPublicKey();
    const privateKey = vapidPrivateKey();
    if (!publicKey || !privateKey) {
      return { sent: false, reason: "vapid_not_configured" };
    }

    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { sent: false, reason: "no_subscriptions" };

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (error || !data?.length) {
      return { sent: false, reason: "no_subscriptions" };
    }

    webpush.setVapidDetails(vapidSubject(), publicKey, privateKey);

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag
    });

    let count = 0;
    for (const row of data) {
      if (!row.endpoint || !row.p256dh || !row.auth) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth }
          },
          body
        );
        count += 1;
      } catch (err) {
        const status = statusCodeFromError(err);
        if (status === 410 || status === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", row.endpoint);
        }
      }
    }

    if (count > 0) return { sent: true, count };
    return { sent: false, reason: "send_failed" };
  } catch {
    return { sent: false, reason: "send_failed" };
  }
}
