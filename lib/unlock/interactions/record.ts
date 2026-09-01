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

export async function recordInteraction(input: RecordInteractionInput) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { eventId: null, error: "You need to log in." };
  const { data, error } = await supabase.rpc("record_interaction_event", {
    p_event_type: input.eventType, p_campaign_id: input.campaignId ?? null,
    p_mission_id: input.missionId ?? null, p_challenge_id: input.challengeId ?? null,
    p_creator_id: input.creatorId ?? null, p_location_id: input.locationId ?? null,
    p_product_id: input.productId ?? null, p_event_value: input.eventValue ?? 0,
    p_verification_method: input.verificationMethod ?? "authenticated_session",
    p_metadata: input.metadata ?? {}, p_idempotency_key: input.idempotencyKey ?? null
  });
  if (error) return { eventId: null, error: error.message };
  const paths = input.revalidate ?? ["/discover", "/wallet", "/dashboard", "/studio"];
  if (input.campaignId) paths.push(`/campaign/${input.campaignId}`);
  for (const p of paths) revalidatePath(p);
  return { eventId: data as string, error: null };
}
