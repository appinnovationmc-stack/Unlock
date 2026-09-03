import { createClient } from "@/lib/supabase/server";
import type { Campaign } from "@/lib/types";
import type { MapPin } from "@/components/unlock/map/LiveMap";

export type LiveField = {
  pins: MapPin[];
  campaigns: Campaign[];
};

function pinCampaignStub(pin: MapPin): Campaign {
  return {
    id: pin.campaign_id,
    title: pin.campaign_title,
    tagline: pin.label,
    description: null,
    objective: null,
    mechanics: ["geolocation"],
    xp_value: 0,
    status: "live"
  } as Campaign;
}

/**
 * Single source for the public field.
 * Pins and experiences both come from live-only SECURITY DEFINER RPCs
 * so Discover cannot show 5 pins and 0 campaigns.
 */
export async function getLiveField(): Promise<LiveField> {
  const supabase = createClient();

  let pins: MapPin[] = [];
  const { data: pinData, error: pinError } = await supabase.rpc("get_live_map_pins");
  if (!pinError && Array.isArray(pinData)) {
    pins = pinData as MapPin[];
  }

  let campaigns: Campaign[] = [];
  const { data: expData, error: expError } = await supabase.rpc("get_live_experiences");
  if (!expError && Array.isArray(expData) && expData.length > 0) {
    campaigns = expData as Campaign[];
  } else {
    const { data: tableRows } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "live")
      .order("created_at", { ascending: false });
    campaigns = (tableRows as Campaign[]) ?? [];
  }

  if (campaigns.length === 0 && pins.length > 0) {
    const seen = new Set<string>();
    for (const pin of pins) {
      if (seen.has(pin.campaign_id)) continue;
      seen.add(pin.campaign_id);
      campaigns.push(pinCampaignStub(pin));
    }
  }

  return { pins, campaigns };
}
