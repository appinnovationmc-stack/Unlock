import { createClient } from "@/lib/supabase/server";

export type LedgerRow = {
  id: string;
  kind: string;
  when: string;
  campaignId: string | null;
};

export type ConsumerLedger = {
  unlocks: number;
  rewards: number;
  visits: number;
  views: number;
  rows: LedgerRow[];
};

function label(kind: string) {
  if (kind === "LOCATION_CHECKIN") return "You arrived";
  if (kind === "UNLOCK" || kind === "REWARD_UNLOCK") return "You unlocked it";
  if (kind === "VIEW" || kind === "CAMPAIGN_VIEW") return "You opened it";
  if (kind === "SHARE") return "You passed it on";
  if (kind === "QR_SCAN") return "You scanned";
  if (kind === "NFC_TAP") return "You tapped";
  return kind.replace(/_/g, " ").toLowerCase();
}

export async function getConsumerLedger(userId: string): Promise<ConsumerLedger> {
  const supabase = createClient();

  const { count: unlocks } = await supabase
    .from("campaign_participations")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", userId)
    .not("unlocked_at", "is", null);

  const { count: rewards } = await supabase
    .from("reward_claims")
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", userId);

  let visits = 0;
  let views = 0;
  let rows: LedgerRow[] = [];
  try {
    const { data } = await supabase
      .from("interaction_events")
      .select("id, event_type, created_at, campaign_id")
      .eq("consumer_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    for (const e of data ?? []) {
      const kind = String(e.event_type ?? "");
      if (kind === "LOCATION_CHECKIN") visits += 1;
      if (kind === "VIEW" || kind === "CAMPAIGN_VIEW") views += 1;
      rows.push({
        id: String(e.id),
        kind: label(kind),
        when: e.created_at ? new Date(e.created_at).toLocaleString() : "",
        campaignId: e.campaign_id ?? null
      });
    }
  } catch {
    rows = [];
  }

  return {
    unlocks: unlocks ?? 0,
    rewards: rewards ?? 0,
    visits,
    views,
    rows
  };
}
