"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { InteractionEventType, VerificationMethod } from "@/lib/types";

export interface RecordInteractionInput {
  eventType: InteractionEventType;
  campaignId?: string | null; missionId?: string | null; challengeId?: string | null;
  creatorId?: string | null; locationId?: string | null; productId?: string | null;
  eventValue?: number; verificationMethod?: VerificationMethod;
  metadata?: Record<string, unknown>; idempotencyKey?: string | null; revalidate?: string[];
}

/** Session analytics only. Never conversion, CPE, unlock, or GPS verify. */
const SESSION_ANALYTICS: ReadonlySet<InteractionEventType> = new Set([
  "CAMPAIGN_VIEW",
  "SHARE",
  "REFERRAL_CLICK"
]);

/** Insert pending. GPS verify is verify_location_checkin only. NFC/QR stay pending until a real scan. */
const PENDING_CLIENT: ReadonlySet<InteractionEventType> = new Set([
  "LOCATION_CHECKIN",
  "NFC_SCAN",
  "QR_SCAN",
  "PRODUCT_INTERACTION",
  "REVIEW_SUBMITTED",
  "CONTENT_SUBMITTED"
]);

function methodFor(eventType: InteractionEventType, requested?: VerificationMethod): VerificationMethod {
  if (eventType === "LOCATION_CHECKIN") return "location";
  if (eventType === "NFC_SCAN") return "nfc";
  if (eventType === "QR_SCAN") return "qr";
  if (eventType === "PRODUCT_INTERACTION") return requested === "product" ? "product" : "product";
  if (SESSION_ANALYTICS.has(eventType)) return "authenticated_session";
  return requested ?? "authenticated_session";
}

export async function recordInteraction(input: RecordInteractionInput) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { eventId: null, error: "You need to log in." };

  if (!SESSION_ANALYTICS.has(input.eventType) && !PENDING_CLIENT.has(input.eventType)) {
    return { eventId: null, error: "That event is not recorded from the client." };
  }

  const method = methodFor(input.eventType, input.verificationMethod);

  const { data, error } = await supabase.rpc("record_interaction_event", {
    p_event_type: input.eventType, p_campaign_id: input.campaignId ?? null,
    p_mission_id: input.missionId ?? null, p_challenge_id: input.challengeId ?? null,
    p_creator_id: input.creatorId ?? null, p_location_id: input.locationId ?? null,
    p_product_id: input.productId ?? null, p_event_value: input.eventValue ?? 0,
    p_verification_method: method,
    p_metadata: input.metadata ?? {}, p_idempotency_key: input.idempotencyKey ?? null
  });
  if (error) return { eventId: null, error: error.message };
  const paths = input.revalidate ?? (SESSION_ANALYTICS.has(input.eventType) ? [] : ["/discover"]);
  if (input.campaignId) paths.push(`/campaign/${input.campaignId}`);
  for (const p of paths) revalidatePath(p);
  return { eventId: data as string, error: null };
}
