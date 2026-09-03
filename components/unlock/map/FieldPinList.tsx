"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { unescapeHtmlEntities } from "@/lib/unlock/display-text";

export type FieldPin = {
  location_id: string;
  campaign_id: string;
  campaign_title: string;
  label?: string | null;
  radius_m?: number | null;
  endingSoon?: boolean;
};

export function FieldPinList({ pins }: { pins: FieldPin[] }) {
  const [q, setQ] = useState("");
  const [onlySoon, setOnlySoon] = useState(false);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pins.filter((p) => {
      if (onlySoon && !p.endingSoon) return false;
      if (!needle) return true;
      const hay = `${p.label ?? ""} ${p.campaign_title}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [pins, q, onlySoon]);

  if (pins.length === 0) return null;

  return (
    <section className="page-shell-wide pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
        <p className="section-kicker">Nearby</p>
        <div className="flex gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Look for a place"
            className="bg-ink border border-black/10 px-3 py-1.5 text-sm text-fog outline-none focus:border-volt w-full sm:w-56"
          />
          <button
            type="button"
            onClick={() => setOnlySoon((v) => !v)}
            className={`text-sm px-3 py-1.5 border min-h-11 ${
              onlySoon ? "border-volt text-volt" : "border-black/10 text-mute"
            }`}
          >
            Ending soon
          </button>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="px-4 py-8 text-mute text-sm">Nothing matches.</p>
      ) : (
        <ul className="divide-y divide-black/10 border border-black/10">
          {visible.map((pin) => (
            <li key={pin.location_id}>
              <Link
                href={`/campaign/${pin.campaign_id}`}
                className="flex items-center gap-4 px-4 py-4 hover:bg-black/[0.03] min-h-11"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-fog truncate">
                    {unescapeHtmlEntities(pin.label || pin.campaign_title)}
                  </span>
                  <span className="block text-sm text-mute truncate">
                    {unescapeHtmlEntities(pin.campaign_title)}
                    {pin.endingSoon ? " · ending soon" : ""}
                  </span>
                </span>
                <span className="text-sm text-volt shrink-0">Go</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
