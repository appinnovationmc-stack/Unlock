"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Websocket subscription for this campaign's interaction_events.
 * Insert/update triggers router.refresh so drilldown rows stay current.
 */
export function LiveRealtimeListener({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [lastPing, setLastPing] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      setLastPing(Date.now());
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel(`live-campaign-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "interaction_events",
          filter: `campaign_id=eq.${campaignId}`
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "interaction_events",
          filter: `campaign_id=eq.${campaignId}`
        },
        scheduleRefresh
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [campaignId, router]);

  return (
    <div className="flex items-center gap-2 text-sm text-mute">
      <span className={`inline-flex h-1.5 w-1.5 rounded-full ${connected ? "bg-fog" : "bg-mute"}`} aria-hidden />
      {connected ? "event feed connected" : "connecting"}
      <span className="sr-only" role="status" aria-live="polite">
        {lastPing ? "New activity received" : ""}
      </span>
    </div>
  );
}
