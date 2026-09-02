"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/finance/money";
import type { LiveDrilldownEvent } from "@/lib/actions/live";

export interface LiveStats {
  participating: number;
  interactions: number;
  store_visits: number;
  product_scans: number;
  rewards: number;
  redemptions: number;
  conversions: number;
  discover: number;
  interact: number;
  pending: number;
}
export interface CreatorImpactRow {
  creator_id: string;
  handle?: string;
  impact: number | null;
  interactions: number;
  visits: number;
  conversions: number;
}
export interface LocationStat {
  location_id: string;
  label: string;
  interactions: number;
  visits: number;
  rewards: number;
  conversions: number;
}

const STAGE_EVENTS: Record<string, string[]> = {
  discover: ["CAMPAIGN_VIEW"],
  interact: ["CHALLENGE_START", "CHALLENGE_COMPLETE", "SHARE", "CONTENT_SUBMITTED", "REVIEW_SUBMITTED"],
  visit: ["LOCATION_CHECKIN"],
  unlock: ["REWARD_UNLOCK", "REWARD_CLAIM"],
  redeem: ["REWARD_REDEEM"],
  convert: ["REFERRAL_CONVERSION", "PURCHASE"]
};

const SCAN_TYPES = ["QR_SCAN", "PRODUCT_INTERACTION", "NFC_SCAN"];

type Slice =
  | { kind: "all" }
  | {
      kind: "metric";
      key:
        | "people"
        | "interactions"
        | "store_visits"
        | "product_scans"
        | "rewards"
        | "redemptions"
        | "conversions"
        | "pending";
    }
  | { kind: "stage"; stage: keyof typeof STAGE_EVENTS }
  | { kind: "location"; id: string; label: string }
  | { kind: "creator"; id: string; label: string };

function eventLabel(type: string) {
  return type.toLowerCase().replaceAll("_", " ");
}

/** Quiet drilldown hint. Never a fraud banner. Score ≥70 (risk_review) is still not an accusation. */
function riskMuteLine(e: LiveDrilldownEvent): string | null {
  if (e.risk_score == null) return null;
  if (e.risk_score >= 70) return `review · risk ${e.risk_score}`;
  const reasons = e.risk_reasons.map((r) => r.replaceAll("_", " ")).join(" · ");
  return reasons ? `risk ${e.risk_score} · ${reasons}` : `risk ${e.risk_score}`;
}

function matchesSlice(e: LiveDrilldownEvent, slice: Slice) {
  if (slice.kind === "all") return true;
  if (slice.kind === "location") return e.location_id === slice.id;
  if (slice.kind === "creator") return e.creator_id === slice.id;
  if (slice.kind === "stage") return STAGE_EVENTS[slice.stage].includes(e.event_type);
  switch (slice.key) {
    case "people":
    case "interactions":
      return e.verification_status === "verified";
    case "store_visits":
      return e.event_type === "LOCATION_CHECKIN";
    case "product_scans":
      return SCAN_TYPES.includes(e.event_type);
    case "rewards":
      return STAGE_EVENTS.unlock.includes(e.event_type);
    case "redemptions":
      return e.event_type === "REWARD_REDEEM";
    case "conversions":
      return STAGE_EVENTS.convert.includes(e.event_type);
    case "pending":
      return e.verification_status === "pending";
    default:
      return true;
  }
}

function sliceCaption(slice: Slice) {
  if (slice.kind === "all") return "all events";
  if (slice.kind === "location") return slice.label;
  if (slice.kind === "creator") return slice.label;
  if (slice.kind === "stage") return slice.stage;
  const labels: Record<typeof slice.key, string> = {
    people: "people (verified)",
    interactions: "verified interactions",
    store_visits: "store visits",
    product_scans: "product scans",
    rewards: "rewards",
    redemptions: "redeemed",
    conversions: "conversions",
    pending: "pending verification"
  };
  return labels[slice.key];
}

export function LiveCommandCentre({
  campaignTitle,
  campaignId,
  status,
  stats,
  creators = [],
  locations = [],
  events = [],
  truncated = false,
  spendCents = null,
  remainingCents = null
}: {
  campaignTitle: string;
  campaignId: string;
  status: string;
  stats: LiveStats;
  creators?: CreatorImpactRow[];
  locations?: LocationStat[];
  events?: LiveDrilldownEvent[];
  truncated?: boolean;
  spendCents?: number | null;
  remainingCents?: number | null;
}) {
  const [slice, setSlice] = useState<Slice>({ kind: "all" });
  const funnel = [
    { stage: "discover" as const, count: stats.discover },
    { stage: "interact" as const, count: stats.interact },
    { stage: "visit" as const, count: stats.store_visits },
    { stage: "unlock" as const, count: stats.rewards },
    { stage: "redeem" as const, count: stats.redemptions },
    { stage: "convert" as const, count: stats.conversions }
  ];

  const visible = useMemo(() => events.filter((e) => matchesSlice(e, slice)), [events, slice]);
  const peopleInView = useMemo(() => new Set(visible.map((e) => e.user_id)).size, [visible]);

  const toggleMetric = (key: Extract<Slice, { kind: "metric" }> ["key"]) => {
    setSlice((cur) => (cur.kind === "metric" && cur.key === key ? { kind: "all" } : { kind: "metric", key }));
  };

  const metric = (
    label: string,
    value: number,
    key: Extract<Slice, { kind: "metric" }> ["key"]
  ) => {
    const active = slice.kind === "metric" && slice.key === key;
    return (
      <button
        type="button"
        onClick={() => toggleMetric(key)}
        aria-pressed={active}
        className={`text-left border px-5 py-4 ${active ? "border-fog" : "border-white/10 hover:border-white/25"}`}
      >
        <p className="text-sm text-mute">{label}</p>
        <p className="font-display text-3xl mt-1 tabular-nums text-fog">{value.toLocaleString()}</p>
      </button>
    );
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="section-kicker">Studio</p>
          <h1 className="font-display text-3xl md:text-4xl text-fog mt-1">
            {campaignTitle} <span className="text-volt">Live</span>
          </h1>
          <p className="text-sm text-mute mt-2">
            {status}. Tap a number to see the rows behind it.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/studio/live/${campaignId}/play`}
            className="text-sm text-mute border border-white/10 px-3 py-1.5 hover:text-fog"
          >
            Play demo
          </Link>
          <Link href="/studio" className="text-sm text-mute border border-white/10 px-3 py-1.5 hover:text-fog">
            Studio
          </Link>
        </div>
      </header>
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {metric("People", stats.participating, "people")}
        {metric("Interactions", stats.interactions, "interactions")}
        {metric("Store visits", stats.store_visits, "store_visits")}
        {metric("Product scans", stats.product_scans, "product_scans")}
        {metric("Rewards", stats.rewards, "rewards")}
        {metric("Redeemed", stats.redemptions, "redemptions")}
        {metric("Conversions", stats.conversions, "conversions")}
        {metric("Pending", stats.pending, "pending")}
      </section>
      {typeof spendCents === "number" && (
        <p className="text-sm text-mute">
          Visit spend {formatMoney(spendCents)}
          {typeof remainingCents === "number" ? ` · remaining ${formatMoney(remainingCents)}` : ""}
          {" "}· billed on verified check-in, not unlock or XP
        </p>
      )}
      <section className="border border-white/10 p-6">
        <p className="section-kicker mb-2">Funnel</p>
        <p className="text-mute text-sm mb-6">Tap a stage to filter the event list. Counts are verified only.</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
          {funnel.map((s, i) => {
            const active = slice.kind === "stage" && slice.stage === s.stage;
            return (
              <div key={s.stage} className="flex items-center gap-2 sm:flex-1">
                <button
                  type="button"
                  onClick={() =>
                    setSlice(active ? { kind: "all" } : { kind: "stage", stage: s.stage })
                  }
                  aria-pressed={active}
                  className={`flex-1 text-center py-3 border ${active ? "border-fog" : "border-white/10 hover:border-white/25"}`}
                >
                  <p className="text-sm text-mute">{s.stage}</p>
                  <p className="font-display text-xl text-fog tabular-nums">{s.count.toLocaleString()}</p>
                </button>
                {i < funnel.length - 1 && <span className="hidden sm:block text-mute px-1">→</span>}
              </div>
            );
          })}
        </div>
      </section>
      {locations.length > 0 && (
        <section>
          <p className="section-kicker mb-4">Locations</p>
          <div className="border border-white/10 divide-y divide-white/10">
            {locations.map((loc) => {
              const active = slice.kind === "location" && slice.id === loc.location_id;
              return (
                <button
                  type="button"
                  key={loc.location_id}
                  onClick={() =>
                    setSlice(
                      active ? { kind: "all" } : { kind: "location", id: loc.location_id, label: loc.label }
                    )
                  }
                  aria-pressed={active}
                  className={`w-full text-left px-4 py-3 ${active ? "bg-white/5" : ""}`}
                >
                  <p className="font-display text-fog">{loc.label}</p>
                  <p className="text-sm text-mute mt-1">
                    {loc.interactions} interactions · {loc.visits} visits · {loc.rewards} rewards ·{" "}
                    {loc.conversions} conversions
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <section>
        <p className="section-kicker mb-4">Impact</p>
        {creators.length === 0 ? (
          <p className="text-mute text-sm">No creator attribution yet.</p>
        ) : (
          <div className="border border-white/10 divide-y divide-white/10">
            {creators.slice(0, 8).map((c, i) => {
              const label = c.handle ?? c.creator_id.slice(0, 8);
              const active = slice.kind === "creator" && slice.id === c.creator_id;
              return (
                <button
                  type="button"
                  key={c.creator_id}
                  onClick={() =>
                    setSlice(active ? { kind: "all" } : { kind: "creator", id: c.creator_id, label })
                  }
                  aria-pressed={active}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 ${active ? "bg-white/5" : ""}`}
                >
                  <p className="text-fog">
                    {i + 1}. {label}
                  </p>
                  <p className="text-sm text-mute tabular-nums">
                    {c.impact == null ? "pending impact" : `${c.impact.toLocaleString()} impact`} · {c.visits}{" "}
                    visits · {c.conversions} conversions
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <p className="section-kicker">Events</p>
            <p className="text-sm text-mute mt-1">
              {sliceCaption(slice)}
              {" · "}
              {visible.length} row{visible.length === 1 ? "" : "s"}
              {slice.kind === "metric" && slice.key === "people"
                ? ` · ${peopleInView} distinct people in these rows`
                : ""}
              {truncated ? " · latest 250 for this campaign" : ""}
            </p>
          </div>
          {slice.kind !== "all" && (
            <button type="button" onClick={() => setSlice({ kind: "all" })} className="text-sm text-mute hover:text-fog">
              Clear filter
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="text-mute text-sm border border-white/10 px-4 py-8">
            {events.length === 0
              ? "No events yet. Counts stay empty until people actually show up."
              : "No rows match this filter in the loaded events."}
          </p>
        ) : (
          <div className="border border-white/10 divide-y divide-white/10">
            {visible.map((e) => {
              const risk = riskMuteLine(e);
              return (
                <article key={e.id} className="px-4 py-3">
                  <p className="text-fog">{eventLabel(e.event_type)}</p>
                  <p className="text-sm text-mute mt-1">
                    {e.campaign_title}
                    {" · "}
                    {new Date(e.created_at).toLocaleString()}
                    {" · "}
                    {e.location_label ?? "no location"}
                    {" · "}
                    {e.creator_label ?? "no creator"}
                    {" · "}
                    {e.verification_status}
                    {e.verification_method ? ` (${e.verification_method.replaceAll("_", " ")})` : ""}
                    {" · "}
                    {e.impact_points == null ? "no impact" : `${e.impact_points} impact`}
                  </p>
                  {risk && <p className="text-sm text-mute mt-1">{risk}</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
