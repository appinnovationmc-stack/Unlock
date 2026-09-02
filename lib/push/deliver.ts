import { createClient } from "@/lib/supabase/server";
import { isPushSendReady } from "./config";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type DeliverResult =
  | { sent: false; reason: "vapid_not_configured" }
  | { sent: false; reason: "no_subscriptions" }
  | { sent: false; reason: "sender_not_implemented" };

/**
 * Attempt Web Push to the signed-in user's stored subscriptions.
 * Does not throw into product UI. Never reports success without a real send.
 *
 * Remaining gap: no `web-push` (or equivalent) sender in this repo, so even
 * with VAPID keys present this returns sender_not_implemented rather than
 * pretending a notification left the server.
 */
export async function deliverPushToCurrentUser(payload: PushPayload): Promise<DeliverResult> {
  void payload;
  if (!isPushSendReady()) {
    return { sent: false, reason: "vapid_not_configured" };
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { sent: false, reason: "no_subscriptions" };

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", user.id);

  if (error || !data?.length) {
    return { sent: false, reason: "no_subscriptions" };
  }

  return { sent: false, reason: "sender_not_implemented" };
}
