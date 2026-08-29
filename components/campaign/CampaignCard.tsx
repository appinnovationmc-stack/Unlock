import Link from "next/link";
import type { Campaign } from "@/lib/types";

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

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link
      href={`/campaign/${campaign.id}`}
      className="group relative block clip-keyhole bg-ink2 noise-overlay overflow-hidden
        border border-white/5 hover:border-volt/40 transition-colors duration-200"
    >
      <div className="aspect-[4/3] w-full bg-duotone flex items-end p-5">
        <div className="flex flex-wrap gap-1.5">
          {campaign.mechanics.slice(0, 3).map((m) => (
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
          {campaign.title}
        </h3>
        <p className="mt-1 text-sm text-mute line-clamp-2">{campaign.tagline}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-xs text-volt">+{campaign.xp_value} XP</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-mute group-hover:text-fog transition-colors">
            Unlock →
          </span>
        </div>
      </div>
    </Link>
  );
}
