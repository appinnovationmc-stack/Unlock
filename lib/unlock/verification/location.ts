"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Client wrapper for verify_location_checkin.
 * Live RPC contract (latest: 20260902042500): (p_event_id, p_lat, p_lng) only.
 * No p_location_id. When location_id on the event is null, the RPC still
 * geofences GPS against every campaign_locations row for that campaign,
 * picks the nearest pin within that pin's radius_m, and writes location_id.
 * Also: reject GPS accuracy > 250m; 10 min rate limit between verified
 * check-ins on the same campaign. Do not weaken those checks here.
 * Optional locationId is the intended public pin (recorded on the pending
 * event). It is not sent as an RPC argument — the catalog has no such param.
 */
export async function verifyLocationCheckin(
  eventId: string,
  lat: number,
  lng: number,
  campaignId?: string,
  _locationId?: string | null
) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { verified: false, error: "Not authenticated", locationId: null, distanceM: null };

  // Visit CPE debit AND creator-earning auto-verify run inside
  // verify_location_checkin (SECURITY DEFINER), not from the client.
  // Do not call verify_creator_earning from the app.
  const { data, error } = await supabase.rpc("verify_location_checkin", {
    p_event_id: eventId,
    p_lat: lat,
    p_lng: lng
  });

  if (error) {
    return { verified: false, error: error.message, locationId: null, distanceM: null };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (campaignId) {
    revalidatePath(`/campaign/${campaignId}`);
    revalidatePath(`/studio/live/${campaignId}`);
    revalidatePath("/studio");
    revalidatePath("/wallet");
    revalidatePath("/dashboard/wallet");
    revalidatePath("/impact");
  }

  return {
    verified: !!(row as { verified?: boolean })?.verified,
    locationId: (row as { location_id?: string })?.location_id ?? null,
    distanceM: (row as { distance_m?: number })?.distance_m ?? null,
    error: null as string | null
  };
}
