import { UnlockClient } from "@/components/campaign/UnlockClient";
import { RecordCampaignView } from "@/components/unlock/interactions/RecordView";
import { RecordReferralClick } from "@/components/unlock/interactions/RecordReferralClick";
import { ShareDrop } from "@/components/unlock/interactions/ShareDrop";
import { ClaimPost } from "@/components/unlock/interactions/ClaimPost";
import { NfcScan } from "@/components/unlock/experiences/NfcScan";
import { QrScan } from "@/components/unlock/experiences/QrScan";
import { ProductHuntClaim } from "@/components/campaign/ProductHuntClaim";
import { WalkRadar } from "@/components/unlock/map/WalkRadar";
import { getLiveField } from "@/lib/unlock/field/live";
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
    .select("label, value, stock, redeemed_count")
    .eq("campaign_id", params.id)
    .limit(1)
    .maybeSingle();

  const remaining =
    reward && reward.stock != null
      ? Math.max(0, Number(reward.stock) - Number(reward.redeemed_count ?? 0))
      : null;

  const field = await getLiveField();
  const pin = field.pins.find((p) => p.campaign_id === params.id) ?? null;
  const campaignPinIds = field.pins
    .filter((p) => p.campaign_id === params.id && p.location_id)
    .map((p) => p.location_id);

  let experienceType: string | null = null;
  try {
    const { data: exp } = await supabase
      .from("experience_configs")
      .select("primary_type")
      .eq("campaign_id", params.id)
      .maybeSingle();
    experienceType = (exp as { primary_type?: string } | null)?.primary_type ?? null;
  } catch {
    /* */
  }

  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, description, experience_type, mission_steps ( title, description, sort_order )")
    .eq("campaign_id", params.id)
    .order("sort_order", { ascending: true });

  const { data: brand } = await supabase
    .from("organizations")
    .select("name, industry")
    .eq("id", campaign.org_id)
    .maybeSingle();

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
      {campaign.status !== "live" && <p className="mb-4 section-kicker">Preview</p>}

      <p className="section-kicker mb-2">{brand?.name ?? "Something is waiting"}</p>
      <h1 className="font-display text-3xl md:text-5xl text-fog mb-3 leading-[0.95] tracking-tight">
        {rewardLabel}
      </h1>
      {remaining != null ? (
        <p className="text-mute text-sm mb-2">
          {remaining === 0 ? "It’s gone." : `${remaining} left`}
        </p>
      ) : null}
      <p className="text-mute text-lg mb-8 leading-snug">{campaign.title}</p>
      {campaign.tagline ? <p className="text-mute text-base -mt-6 mb-8">{campaign.tagline}</p> : null}

      {pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng) ? (
        <div className="mb-8">
          <WalkRadar lat={pin.lat} lng={pin.lng} radiusM={pin.radius_m || 150} />
        </div>
      ) : null}

      <div className="grid gap-8 mb-12">
        <div>
          <p className="section-kicker">What you do</p>
          <p className="text-fog text-base mt-1">{actionHint}</p>
        </div>
        {missions && missions.length > 0 ? (
          <div>
            <p className="section-kicker">The walk</p>
            <ul className="mt-3 space-y-4">
              {missions.map((mission) => {
                const steps = Array.isArray(mission.mission_steps)
                  ? [...mission.mission_steps].sort(
                      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                    )
                  : [];
                return (
                  <li key={mission.id}>
                    <p className="font-display text-lg text-fog">{mission.title}</p>
                    {mission.description ? (
                      <p className="text-mute text-sm mt-1">{mission.description}</p>
                    ) : null}
                    {steps.length > 0 ? (
                      <ol className="mt-2 space-y-1 text-sm text-fog">
                        {steps.map((step, i) => (
                          <li key={`${mission.id}-${i}`}>
                            {i + 1}. {step.title}
                            {step.description ? (
                              <span className="text-mute"> — {step.description}</span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
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

      <div className="mt-6">
        <ShareDrop campaignId={campaign.id} title={campaign.title} referrerId={user?.id ?? referrerCreatorId} />
      </div>
      {user ? (
        <div className="mt-4">
          <ClaimPost campaignId={campaign.id} userId={user.id} />
        </div>
      ) : null}

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
