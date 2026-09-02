import { UnlockClient } from "@/components/campaign/UnlockClient";
import { RecordCampaignView } from "@/components/unlock/interactions/RecordView";
import { RecordReferralClick } from "@/components/unlock/interactions/RecordReferralClick";
import { NfcScan } from "@/components/unlock/experiences/NfcScan";
import { ProductHuntClaim } from "@/components/campaign/ProductHuntClaim";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { ref?: string; code?: string };
}) {
  const supabase = createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!campaign) return notFound();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  let isOwner = false;
  if (user && campaign.status !== "live") {
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("org_id", campaign.org_id)
      .maybeSingle();
    isOwner = !!membership;
    if (!isOwner) return notFound();
  }

  if (campaign.status !== "live" && !isOwner) return notFound();

  const { data: reward } = await supabase
    .from("rewards")
    .select("label, value")
    .eq("campaign_id", params.id)
    .limit(1)
    .maybeSingle();

  let experienceType: string | null = null;
  try {
    const { data: exp } = await supabase
      .from("experience_configs")
      .select("primary_type")
      .eq("campaign_id", params.id)
      .maybeSingle();
    experienceType = (exp as { primary_type?: string } | null)?.primary_type ?? null;
  } catch { /* */ }

  const { count: pinCount } = await supabase
    .from("campaign_locations")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.id);

  const rewardLabel = reward?.label
    ? `${reward.label}${reward.value ? " — " + reward.value : ""}`
    : "+" + (campaign.xp_value ?? 0) + " XP";

  const referrerCreatorId = searchParams.ref || null;

  const { count: productCodeCount } = await supabase
    .from("product_codes")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.id);

  const isProductHunt = (productCodeCount ?? 0) > 0;

  const mechanics = (campaign.mechanics ?? []) as string[];
  const requireVisit =
    (pinCount ?? 0) > 0 ||
    mechanics.includes("geolocation") ||
    mechanics.includes("treasure_hunt") ||
    experienceType === "VISIT";

  const actionHint = isProductHunt
    ? "Find the product. Enter the code. Prove it. Unlock."
    : requireVisit
      ? "Get close. Check in. Hold to unlock."
      : mechanics.includes("qr_scan")
        ? "Hunt it down. Scan. Unlock."
        : mechanics.includes("nfc_tap")
          ? "Tap the tag. Unlock."
          : mechanics.includes("quiz") || mechanics.includes("puzzle")
            ? "Face the challenge. Tap through. Claim what you earn."
            : "Hold the seal. Complete the moment. Take the reward.";

  const actionLine = campaign.tagline || actionHint;

  return (
    <main className="page-shell min-h-screen">
      {user && campaign.status === "live" && (
        <RecordCampaignView campaignId={campaign.id} creatorId={referrerCreatorId} />
      )}
      {user && campaign.status === "live" && referrerCreatorId && (
        <RecordReferralClick campaignId={campaign.id} creatorId={referrerCreatorId} />
      )}
      {campaign.status !== "live" && (
        <p className="mb-4 section-kicker border border-white/15 px-3 py-2 inline-block">
          Preview · {campaign.status}
        </p>
      )}

      {experienceType && (
        <p className="mb-3 section-kicker">{experienceType}</p>
      )}
      {referrerCreatorId && (
        <p className="mb-4 text-sm text-mute">Opened via creator path</p>
      )}

      <h1 className="font-display text-3xl md:text-5xl text-fog mb-3 leading-tight">
        {campaign.title}
      </h1>
      <p className="text-mute text-lg mb-8 leading-snug">{actionLine}</p>

      <div className="grid gap-6 mb-10">
        <div>
          <p className="section-kicker">What is this</p>
          <p className="text-fog text-base mt-1 leading-relaxed">
            {campaign.description ||
              campaign.tagline ||
              "A brand experience. Not a banner — a moment you complete."}
          </p>
        </div>
        <div>
          <p className="section-kicker">What you do</p>
          <p className="text-fog text-base mt-1">{actionHint}</p>
        </div>
        <div>
          <p className="section-kicker">What you get</p>
          <p className="text-fog text-base mt-1">
            {rewardLabel}
            {reward?.label ? (
              <span className="text-mute"> · +{campaign.xp_value} XP</span>
            ) : null}
          </p>
        </div>
      </div>

      {mechanics.includes("nfc_tap") && campaign.status === "live" && (
        <div className="mb-6">
          <NfcScan campaignId={campaign.id} />
        </div>
      )}

      {isProductHunt ? (
        <ProductHuntClaim campaignId={campaign.id} initialCode={searchParams.code} />
      ) : (
        <UnlockClient
          campaignId={campaign.id}
          rewardLabel={rewardLabel}
          campaignTitle={campaign.title}
          referrerCreatorId={referrerCreatorId}
          requireVisit={requireVisit && campaign.status === "live"}
        />
      )}

      <div className="mt-12 flex justify-center gap-6 text-sm">
        <Link href="/discover" className="text-mute hover:text-fog">
          ← Field
        </Link>
        <Link href="/wallet" className="text-mute hover:text-fog">
          Collection →
        </Link>
      </div>
    </main>
  );
}
