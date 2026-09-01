import Link from "next/link";
import type { Campaign } from "@/lib/types";
import { unescapeHtmlEntities } from "@/lib/unlock/display-text";

const mechanicLabels: Record<string, string> = {
  quiz: "Quiz",
  puzzle: "Puzzle",
  riddle: "Riddle",
  treasure_hunt: "Treasure Hunt",
  qr_scan: "QR",
  nfc_tap: "NFC",
  geolocation: "Location",
  timed_challenge: "Timed",
  social_action: "Social",
  referral: "Referral"
};

function campaignArtUrl(campaign: Campaign): string | null {
  const raw = campaign.cover_image_url || campaign.hero_image_url;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return raw;
  } catch {
    return raw.startsWith("/") ? raw : null;
  }
}

export function CampaignCard({
  campaign,
  kindLabel = "Encounter"
}: {
  campaign: Campaign;
  kindLabel?: string;
}) {
  const title = unescapeHtmlEntities(campaign.title) || "Untitled encounter";
  const tagline =
    unescapeHtmlEntities(campaign.tagline) || "Step in. Complete it. Unlock what's inside.";
  const art = campaignArtUrl(campaign);

  return (
    <Link
      href={`/campaign/${campaign.id}`}
      className="group relative block clip-keyhole bg-ink2 noise-overlay overflow-hidden
        border border-white/5 hover:border-volt/40 transition-colors duration-200"
    >
      <div className="aspect-[4/3] w-full bg-duotone flex flex-col justify-between p-5 relative">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element -- optional user-supplied campaign art, not a brand asset we ship
          <img
            src={art}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          />
        ) : null}
        <span className="relative z-[1] font-mono text-[10px] uppercase tracking-widest text-volt self-start border border-volt/30 px-2 py-0.5 bg-void/50">
          {kindLabel}
        </span>
        <div className="relative z-[1] flex flex-wrap gap-1.5">
          {(campaign.mechanics ?? []).slice(0, 3).map((m) => (
            <span
              key={m}
              className="font-mono text-[10px] uppercase tracking-wider text-void bg-fog/90 px-2 py-0.5 rounded-sm"
            >
              {mechanicLabels[m] ?? m}
            </span>
          ))}
        </div>
      </div>

      <div className="p-5 border-t border-white/5">
        <h3 className="font-display text-lg leading-tight text-fog group-hover:text-glow-volt transition-all">
          {title}
        </h3>
        <p className="mt-1 text-sm text-mute line-clamp-2">{tagline}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-xs text-volt">+{campaign.xp_value} XP</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-mute group-hover:text-fog transition-colors">
            Enter →
          </span>
        </div>
      </div>
    </Link>
  );
}
