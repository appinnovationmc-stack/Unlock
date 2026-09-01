"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Replaces the 30s revalidate poll on the LIVE command centre with a real
 * websocket subscription (Supabase Realtime → Postgres changefeed).
 * Any verified interaction_event for this campaign triggers an instant
 * router.refresh() instead of waiting for the next revalidation window.
 *
 * Requires: `alter publication supabase_realtime add table interaction_events;`
 * on the Supabase project (Realtime must be enabled for the table).
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
      // Debounce bursts of events (e.g. many check-ins at once) into one refresh.
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
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-mute">
      <span
        className={`inline-flex h-1.5 w-1.5 rounded-full ${
          connected ? "bg-volt animate-pulse" : "bg-mute"
        }`}
        aria-hidden
      />
      {connected ? "Live · websocket connected" : "Connecting…"}
      <span className="sr-only" role="status" aria-live="polite">
        {lastPing ? "New activity received" : ""}
      </span>
    </div>
  );
}
