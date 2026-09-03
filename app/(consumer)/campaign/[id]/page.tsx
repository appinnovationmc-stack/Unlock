import { UnlockClient } from "@/components/campaign/UnlockClient";
import { RecordCampaignView } from "@/components/unlock/interactions/RecordView";
import { RecordReferralClick } from "@/components/unlock/interactions/RecordReferralClick";
import { NfcScan } from "@/components/unlock/experiences/NfcScan";
import { QrScan } from "@/components/unlock/experiences/QrScan";
import { ProductHuntClaim } from "@/components/campaign/ProductHuntClaim";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LiveMapPinRow = {
  location_id: string;
  campaign_id: string;
};

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
    .select("label, value, stock, redeemed_count")
    .eq("campaign_id", params.id)
    .limit(1)
    .maybeSingle();

  const ticketsLeft =
    reward && reward.stock != null
      ? Math.max(0, Number(reward.stock) - Number(reward.redeemed_count ?? 0))
      : null;

  let experienceType: string | null = null;
  try {
    const { data: exp } = await supabase
      .from("experience_configs")
      .select("primary_type")
      .eq("campaign_id", params.id)
      .maybeSingle();
    experienceType = (exp as { primary_type?: string } | null)?.primary_type ?? null;
  } catch { /* */ }

  let campaignPinIds: string[] = [];
  const { data: livePins, error: pinError } = await supabase.rpc("get_live_map_pins");
  if (!pinError && Array.isArray(livePins)) {
    campaignPinIds = (livePins as LiveMapPinRow[])
      .filter((p) => p.campaign_id === params.id && p.location_id)
      .map((p) => p.location_id);
  }

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
    campaignPinIds.length > 0 ||
    mechanics.includes("geolocation") ||
    mechanics.includes("treasure_hunt") ||
    experienceType === "VISIT";

  const actionHint = isProductHunt
    ? "Find it. Prove it. Unlock."
    : requireVisit
      ? "Find it. Get close. Unlock it."
      : "Hold to unlock.";

  return (
    <main className="page-shell min-h-screen">
      {user && campaign.status === "live" && (
        <RecordCampaignView campaignId={campaign.id} creatorId={referrerCreatorId} />
      )}
      {user && campaign.status === "live" && referrerCreatorId && (
        <RecordReferralClick campaignId={campaign.id} creatorId={referrerCreatorId} />
      )}
      {campaign.status !== "live" && (
        <p className="mb-4 section-kicker">Preview</p>
      )}

      <p className="section-kicker mb-2">Something is waiting</p>
      <h1 className="font-display text-3xl md:text-5xl text-fog mb-3 leading-[0.95] tracking-tight">
        {rewardLabel}
      </h1>
      {ticketsLeft != null ? (
        <p className="text-mute text-sm mb-2">
          {ticketsLeft === 0 ? "The last ticket is gone." : `${ticketsLeft} left`}
        </p>
      ) : null}
      <p className="text-mute text-lg mb-10 leading-snug">{campaign.title}</p>

      <div className="grid gap-8 mb-12">
        <div>
          <p className="section-kicker">Where</p>
          <p className="text-fog text-base mt-1">
            {requireVisit
              ? campaignPinIds.length
                ? "On the map. Get close."
                : "A place in the world. Get close."
              : "From here."}
          </p>
        </div>
        <div>
          <p className="section-kicker">What you do</p>
          <p className="text-fog text-base mt-1">{actionHint}</p>
        </div>
      </div>

      {mechanics.includes("nfc_tap") && campaign.status === "live" && (
        <div className="mb-6">
          <NfcScan campaignId={campaign.id} />
        </div>
      )}
      {(mechanics.includes("qr_scan") || mechanics.includes("nfc_tap")) && campaign.status === "live" && (
        <div className="mb-6">
          <QrScan campaignId={campaign.id} />
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
          authenticated={!!user}
          pinLocationIds={campaignPinIds}
        />
      )}

      <div className="mt-12 flex justify-center gap-6 text-sm">
        <Link href="/discover" className="text-mute hover:text-fog">
          Explore
        </Link>
        <Link href="/wallet" className="text-mute hover:text-fog">
          Rewards
        </Link>
      </div>
    </main>
  );
}
