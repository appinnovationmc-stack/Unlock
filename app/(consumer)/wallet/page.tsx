import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { XPBadge } from "@/components/ui/XPBadge";
import { RedeemButton } from "@/components/wallet/RedeemButton";

export const dynamic = "force-dynamic";

type Nested<T> = T | T[] | null;

type InteractionRef = {
  event_type: string;
  verification_status: string;
};

type CampaignRef = {
  title: string | null;
};

type ImpactTrailRow = {
  id: string;
  points: number;
  created_at: string;
  campaign_id: string | null;
  campaigns: Nested<CampaignRef>;
  interaction_events: Nested<InteractionRef>;
};

type RewardRef = {
  label?: string | null;
  value?: string | null;
  type?: string | null;
};

type ClaimRow = {
  id: string;
  status: string;
  campaign_id?: string | null;
  rewards?: Nested<RewardRef>;
};

const REWARD_GROUPS: { title: string; statuses: string[] }[] = [
  { title: "Claimed", statuses: ["claimed"] },
  { title: "Redeemed", statuses: ["redeemed"] },
  { title: "Expired", statuses: ["expired"] },
  { title: "Pending", statuses: ["pending_verification", "pending"] },
  { title: "Available", statuses: ["available"] },
  { title: "Reversed", statuses: ["reversed"] }
];

function one<T>(value: Nested<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function verifiedActionLabel(eventType: string): string {
  switch (eventType) {
    case "LOCATION_CHECKIN":
      return "Verified store visit";
    case "REWARD_UNLOCK":
      return "Verified unlock";
    case "CAMPAIGN_VIEW":
      return "Verified campaign view";
    case "SHARE":
      return "Verified share";
    case "CHALLENGE_START":
      return "Verified challenge start";
    default:
      return `Verified ${eventType.toLowerCase().replace(/_/g, " ")}`;
  }
}

function formatTrailTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(new Date(iso));
}

function statusLabel(status: string): string {
  if (status === "pending_verification") return "Pending";
  return status.replace(/_/g, " ");
}

function ClaimCard({ claim }: { claim: ClaimRow }) {
  const reward = one(claim.rewards);
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <p className="font-display text-fog truncate">{reward?.label ?? "Reward"}</p>
        <p className="font-mono text-xs text-mute mt-0.5">
          {reward?.value}
          {reward?.type ? ` · ${reward.type}` : ""}
        </p>
      </div>
      {claim.status === "claimed" ? (
        <RedeemButton claimId={claim.id} campaignId={claim.campaign_id} />
      ) : (
        <span
          className={`font-mono text-[10px] shrink-0 ${
            claim.status === "redeemed"
              ? "text-gold"
              : claim.status === "expired" || claim.status === "reversed"
                ? "text-mute"
                : "text-fog"
          }`}
        >
          {statusLabel(claim.status)}
        </span>
      )}
    </div>
  );
}

export default async function WalletPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: consumer } = await supabase
    .from("consumers")
    .select("id, handle, xp")
    .eq("id", user.id)
    .maybeSingle();

  if (!consumer) {
    return (
      <main className="page-shell min-h-screen bg-void">
        <h1 className="font-display text-2xl text-fog mb-4">Collection</h1>
        <p className="text-mute text-sm">
          Your collection is for consumer accounts. Sign up as a consumer to gather unlocks
          and rewards.
        </p>
      </main>
    );
  }

  const { data: claims } = await supabase
    .from("reward_claims")
    .select("id, status, campaign_id, rewards(label, value, type)")
    .eq("consumer_id", user.id)
    .order("claimed_at", { ascending: false });

  const claimRows = (claims ?? []) as ClaimRow[];

  let impactTotal: number | null = null;
  let impactVisits: number | null = null;
  let impactError = false;
  try {
    const { data: score, error } = await supabase
      .from("impact_scores")
      .select("total_impact, store_visits")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) impactError = true;
    else if (score) {
      impactTotal = score.total_impact;
      impactVisits = score.store_visits;
    }
  } catch {
    impactError = true;
  }

  let trail: {
    id: string;
    points: number;
    label: string;
    campaign: string | null;
    at: string;
  }[] = [];
  let trailError = false;
  try {
    const { data: rows, error } = await supabase
      .from("impact_events")
      .select(
        "id, points, created_at, campaign_id, campaigns(title), interaction_events!inner(event_type, verification_status)"
      )
      .eq("user_id", user.id)
      .eq("interaction_events.verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) trailError = true;
    else {
      trail = ((rows ?? []) as ImpactTrailRow[])
        .map((row) => {
          const event = one(row.interaction_events);
          if (!event || event.verification_status !== "verified") return null;
          if (typeof row.points !== "number") return null;
          const campaign = one(row.campaigns)?.title?.trim() || null;
          return {
            id: row.id,
            points: row.points,
            label: verifiedActionLabel(event.event_type),
            campaign,
            at: formatTrailTime(row.created_at)
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    }
  } catch {
    trailError = true;
  }

  const impactLabel = impactError
    ? "Unavailable"
    : impactTotal == null
      ? "Pending"
      : impactTotal.toLocaleString();
  const visitsLabel = impactError ? "—" : impactVisits == null ? "Pending" : String(impactVisits);

  const grouped = REWARD_GROUPS.map((group) => ({
    ...group,
    items: claimRows.filter((c) => group.statuses.includes(c.status))
  })).filter((group) => group.items.length > 0);

  const known = new Set(REWARD_GROUPS.flatMap((g) => g.statuses));
  const other = claimRows.filter((c) => !known.has(c.status));

  return (
    <main className="page-shell min-h-screen bg-void">
      <header className="flex items-center justify-between mb-10">
        <div>
          <p className="font-mono text-[10px] text-mute">Collection</p>
          <h1 className="font-display text-2xl text-fog mt-1">@{consumer.handle}</h1>
          <p className="text-mute text-xs mt-1">Proof of every encounter you finished.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/impact"
            className="font-mono text-[10px] text-volt border border-volt/30 px-2 py-1"
          >
            Impact board
          </Link>
          <XPBadge xp={consumer.xp} />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="clip-keyhole-sm bg-ink2 border border-white/8 px-5 py-4">
          <p className="font-mono text-[10px] text-mute">Impact</p>
          <p className="font-display text-2xl text-volt mt-1 tabular-nums">{impactLabel}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] text-mute">XP</p>
          <p className="font-display text-2xl text-fog mt-1">{consumer.xp}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] text-mute">Unlocked</p>
          <p className="font-display text-2xl text-fog mt-1">{claimRows.length}</p>
        </div>
        <div className="clip-keyhole-sm bg-ink2 border border-white/5 px-5 py-4">
          <p className="font-mono text-[10px] text-mute">Visits</p>
          <p className="font-display text-2xl text-fog mt-1">{visitsLabel}</p>
        </div>
      </div>

      <section className="mb-10">
        <p className="font-mono text-[10px] text-mute mb-3">Impact trail</p>
        {trailError ? (
          <p className="text-mute text-sm">Unavailable</p>
        ) : trail.length === 0 ? (
          <p className="text-mute text-sm">Pending — no verified events yet.</p>
        ) : (
          <div className="border border-white/8 divide-y divide-white/5">
            {trail.map((row) => {
              const parts = [
                `${row.points > 0 ? "+" : ""}${row.points} Impact`,
                row.label,
                row.campaign,
                row.at
              ].filter(Boolean);
              return (
                <p key={row.id} className="px-4 py-2.5 text-sm text-fog leading-snug">
                  {parts.join(" · ")}
                </p>
              );
            })}
          </div>
        )}
      </section>

      <h2 className="font-display text-lg text-fog mb-4">Rewards</h2>
      {claimRows.length === 0 ? (
        <div className="border border-white/5 p-6 text-center">
          <p className="text-mute font-mono text-sm mb-3">Nothing collected yet.</p>
          <Link href="/discover" className="text-volt font-mono text-[10px]">
            Enter the field →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.title}>
              <p className="font-mono text-[10px] text-mute mb-3">{group.title}</p>
              <div className="border border-white/5 divide-y divide-white/5">
                {group.items.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} />
                ))}
              </div>
            </section>
          ))}
          {other.length > 0 && (
            <section>
              <p className="font-mono text-[10px] text-mute mb-3">Other</p>
              <div className="border border-white/5 divide-y divide-white/5">
                {other.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-center font-mono text-[10px] text-mute">
        Redeem is enforced server-side. Your collection is proof — not a cash wallet.
      </p>
    </main>
  );
}
