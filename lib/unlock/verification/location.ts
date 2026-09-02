"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function verifyLocationCheckin(
  eventId: string,
  lat: number,
  lng: number,
  campaignId?: string
) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { verified: false, error: "Not authenticated", locationId: null, distanceM: null };

  // Visit CPE debit runs inside verify_location_checkin (SECURITY DEFINER),
  // not from the client. This action only invokes that RPC.
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
    revalidatePath("/impact");
  }

  return {
    verified: !!(row as { verified?: boolean })?.verified,
    locationId: (row as { location_id?: string })?.location_id ?? null,
    distanceM: (row as { distance_m?: number })?.distance_m ?? null,
    error: null as string | null
  };
}
