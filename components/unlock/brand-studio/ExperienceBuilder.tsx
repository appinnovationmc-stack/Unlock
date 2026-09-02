"use client";

import { useMemo, useState } from "react";
import { createCampaign } from "@/lib/actions/campaigns";
import { Button } from "@/components/ui/Button";

const INTENTS = [
  { id: "DISCOVER", label: "Discover", hint: "Find the brand / product", mechanics: [] as string[] },
  { id: "VISIT", label: "Visit", hint: "Go to a store or place", mechanics: ["geolocation"] },
  { id: "PLAY", label: "Play", hint: "Complete a challenge", mechanics: ["timed_challenge"] },
  { id: "SOLVE", label: "Solve", hint: "Quiz, puzzle, riddle", mechanics: ["quiz", "puzzle", "riddle"] },
  { id: "REVIEW", label: "Review", hint: "Leave verified feedback", mechanics: ["social_action"] },
  { id: "SHARE", label: "Share", hint: "Pass it on", mechanics: ["referral", "social_action"] },
  { id: "COLLECT", label: "Collect", hint: "Hunt, scan, gather", mechanics: ["treasure_hunt", "qr_scan", "nfc_tap"] },
  { id: "BUY", label: "Buy", hint: "Drive a purchase", mechanics: ["referral"] }
] as const;

const WHERE = [
  { id: "STORES", label: "Stores" },
  { id: "PRODUCTS", label: "Products" },
  { id: "ONLINE", label: "Online" },
  { id: "EVERYWHERE", label: "Everywhere" }
] as const;

const REWARDS = [
  { id: "CASH", label: "Cash" },
  { id: "VOUCHER", label: "Voucher" },
  { id: "PRODUCT", label: "Product" },
  { id: "DISCOUNT", label: "Discount" },
  { id: "XP", label: "Impact / XP" },
  { id: "ACCESS", label: "Exclusive access" },
  { id: "MYSTERY", label: "Mystery" }
] as const;

const VERIFY = [
  { id: "session", label: "Login only" },
  { id: "qr", label: "QR scan" },
  { id: "nfc", label: "NFC" },
  { id: "location", label: "Location" },
  { id: "product", label: "Product code" },
  { id: "referral", label: "Referral" }
] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm px-3 py-2 border transition-colors ${
        active ? "border-volt text-volt" : "border-white/10 text-mute hover:border-white/25 hover:text-fog"
      }`}
    >
      {children}
    </button>
  );
}

export function ExperienceBuilder() {
  const [intent, setIntent] = useState("COLLECT");
  const [where, setWhere] = useState("STORES");
  const [rewardKind, setRewardKind] = useState("DISCOUNT");
  const [verify, setVerify] = useState("location");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [rewardLabel, setRewardLabel] = useState("");
  const [rewardValue, setRewardValue] = useState("");
  const [xp, setXp] = useState(50);

  const intentMeta = INTENTS.find((i) => i.id === intent) ?? INTENTS[6];
  const mechanics = intentMeta.mechanics;
  const previewTitle = title.trim() || "Untitled experience";
  const previewReward = rewardLabel.trim() || `${rewardKind} reward`;
  const previewHint =
    intent === "VISIT"
      ? "Get close. Check in. Hold to unlock."
      : intent === "COLLECT"
        ? "Hunt it down. Scan. Unlock."
        : intent === "SOLVE"
          ? "Face the challenge. Claim what you earn."
          : "Complete the moment. Take the reward.";

  const measureHints = useMemo(() => {
    const base = ["CAMPAIGN_VIEW", "REWARD_UNLOCK"];
    if (intent === "VISIT") base.push("LOCATION_CHECKIN");
    if (intent === "COLLECT") base.push("QR_SCAN", "PRODUCT_INTERACTION");
    if (intent === "SHARE") base.push("SHARE", "REFERRAL_CLICK");
    if (intent === "BUY") base.push("PURCHASE", "REFERRAL_CONVERSION");
    if (intent === "SOLVE" || intent === "PLAY") base.push("CHALLENGE_COMPLETE");
    return base;
  }, [intent]);

  const field =
    "mt-1 w-full bg-void border border-white/10 focus:border-volt px-3 py-2 text-fog text-base outline-none";

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div>
          <p className="section-kicker mb-1">Build experience</p>
          <h2 className="font-display text-xl text-fog">What do you want people to do?</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {INTENTS.map((i) => (
            <Chip
              key={i.id}
              active={intent === i.id}
              onClick={() => {
                setIntent(i.id);
                if (i.id === "VISIT" || i.id === "COLLECT") setVerify("location");
              }}
            >
              {i.label}
            </Chip>
          ))}
        </div>
        <p className="text-mute text-sm">{intentMeta.hint}</p>

        <div>
          <p className="section-kicker mb-2">Where?</p>
          <div className="flex flex-wrap gap-2">
            {WHERE.map((w) => (
              <Chip key={w.id} active={where === w.id} onClick={() => setWhere(w.id)}>
                {w.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="section-kicker mb-2">What do they get?</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {REWARDS.map((r) => (
              <Chip key={r.id} active={rewardKind === r.id} onClick={() => setRewardKind(r.id)}>
                {r.label}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={rewardLabel}
              onChange={(e) => setRewardLabel(e.target.value)}
              placeholder="Reward label"
              className={field}
            />
            <input
              value={rewardValue}
              onChange={(e) => setRewardValue(e.target.value)}
              placeholder="Value (R50, 20%…)"
              className={field}
            />
          </div>
        </div>

        <div>
          <p className="section-kicker mb-2">How do we verify?</p>
          <div className="flex flex-wrap gap-2">
            {VERIFY.map((v) => (
              <Chip key={v.id} active={verify === v.id} onClick={() => setVerify(v.id)}>
                {v.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="section-kicker mb-2">We will measure</p>
          <div className="flex flex-wrap gap-2">
            {measureHints.map((m) => (
              <span key={m} className="text-xs text-mute border border-white/10 px-2 py-1">
                {m}
              </span>
            ))}
          </div>
        </div>

        <form action={createCampaign} className="space-y-4 border border-white/10 p-5">
          <input type="hidden" name="objective" value={intent.toLowerCase()} />
          {mechanics.map((m) => (
            <input key={m} type="hidden" name="mechanics" value={m} />
          ))}
          <input type="hidden" name="reward_label" value={rewardLabel || previewReward} />
          <input type="hidden" name="reward_value" value={rewardValue} />
          <input type="hidden" name="xp_value" value={String(xp)} />
          <input type="hidden" name="verify" value={verify} />
          <input type="hidden" name="where" value={where} />
          <input type="hidden" name="description" value={previewHint} />

          <label className="block">
            <span className="text-sm text-mute">Title *</span>
            <input
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Midnight Drop"
              className={field}
            />
          </label>
          <label className="block">
            <span className="text-sm text-mute">Tagline</span>
            <input
              name="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One line that hooks participation"
              className={field}
            />
          </label>
          <label className="block">
            <span className="text-sm text-mute">Impact on unlock</span>
            <input
              type="number"
              min={0}
              max={500}
              value={xp}
              onChange={(e) => setXp(Number(e.target.value) || 0)}
              className={field}
            />
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="submit" name="status" value="draft" variant="ghost" className="flex-1">
              Save draft
            </Button>
            <Button type="submit" name="status" value="live" variant="volt" className="flex-1">
              Publish live
            </Button>
          </div>
        </form>
      </div>

      <div className="lg:sticky lg:top-8 h-fit">
        <p className="section-kicker mb-3">Consumer preview</p>
        <div className="border border-white/10 bg-void clip-keyhole overflow-hidden">
          <div className="aspect-[4/3] relative bg-ink2 flex items-center justify-center">
            <div className="relative z-10 text-center px-6">
              <p className="section-kicker mb-2">{intent}</p>
              <p className="font-display text-2xl text-fog mb-1">{previewTitle}</p>
              {tagline ? <p className="text-mute text-sm mb-4">{tagline}</p> : null}
              <p className="text-mute text-sm mb-6 max-w-xs mx-auto">{previewHint}</p>
              <div className="inline-flex flex-col items-center gap-2">
                <span className="h-16 w-16 rounded-full border-2 border-white/25 flex items-center justify-center text-xl text-fog">
                  ◎
                </span>
                <span className="text-sm text-mute">Hold to unlock</span>
              </div>
              <p className="mt-4 text-sm text-fog">{previewReward}</p>
              {rewardValue ? <p className="text-sm text-mute">{rewardValue}</p> : null}
            </div>
          </div>
          <div className="px-4 py-3 border-t border-white/5 flex justify-between text-sm text-mute">
            <span>{where}</span>
            <span>Verify: {verify}</span>
            <span>+{xp} Impact</span>
          </div>
        </div>
        <p className="mt-3 text-mute text-sm">
          Publish live still needs a map pin after save. Verify choice is stored on the experience.
        </p>
      </div>
    </div>
  );
}
