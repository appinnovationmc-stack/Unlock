import { UnlockClient } from "@/components/campaign/UnlockClient";
import { RecordCampaignView } from "@/components/unlock/interactions/RecordView";
import { RecordReferralClick } from "@/components/unlock/interactions/RecordReferralClick";
import { LocationCheckin } from "@/components/unlock/experiences/LocationCheckin";
import { MissionProgress } from "@/components/unlock/missions/MissionProgress";
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

  const rewardLabel = reward
    ? `${reward.label}${reward.value ? " — " + reward.value : ""}`
    : "Something waiting";

  const referrerCreatorId = searchParams.ref || null;

  const { count: productCodeCount } = await supabase
    .from("product_codes")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", params.id);

  const isProductHunt = (productCodeCount ?? 0) > 0;

  const mechanics = (campaign.mechanics ?? []) as string[];
  const actionHint = isProductHunt
    ? "Find the product. Enter the code. Prove it. Unlock."
    : mechanics.includes("quiz")
      ? "Face the challenge. Tap through. Claim what you earn."
      : mechanics.includes("treasure_hunt") || mechanics.includes("qr_scan")
        ? "Hunt it down. Scan. Unlock."
        : "Tap the seal. Complete the moment. Take the reward.";

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-2xl mx-auto">
      {user && campaign.status === "live" && (
        <RecordCampaignView campaignId={campaign.id} creatorId={referrerCreatorId} />
      )}
      {user && campaign.status === "live" && referrerCreatorId && (
        <RecordReferralClick campaignId={campaign.id} creatorId={referrerCreatorId} />
      )}
      {campaign.status !== "live" && (
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-gold border border-gold/30 px-3 py-2 inline-block">
          Preview · {campaign.status}
        </p>
      )}

      {referrerCreatorId && (
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-magenta">
          Opened via creator path
        </p>
      )}

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-volt mb-3">
        Encounter
        {campaign.objective ? ` · ${String(campaign.objective).replace(/_/g, " ")}` : ""}
      </p>

      <h1 className="font-display text-3xl md:text-5xl text-fog mb-3 leading-tight">
        {campaign.title}
      </h1>
      {campaign.tagline && (
        <p className="text-mute text-lg mb-8 leading-snug">{campaign.tagline}</p>
      )}

      {/* WHAT / DO / GET — encounter clarity */}
      <div className="grid gap-3 mb-10">
        <div className="border border-white/10 bg-ink2/50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">What is this</p>
          <p className="text-fog text-sm mt-1 leading-relaxed">
            {campaign.description ||
              campaign.tagline ||
              "A brand experience. Not a banner — a moment you complete."}
          </p>
        </div>
        <div className="border border-white/10 bg-ink2/50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-mute">What you do</p>
          <p className="text-fog text-sm mt-1">{actionHint}</p>
        </div>
        <div className="border border-volt/20 bg-volt/5 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-volt">What you get</p>
          <p className="text-fog text-sm mt-1">
            {rewardLabel}
            <span className="text-mute"> · +{campaign.xp_value} XP</span>
          </p>
        </div>
      </div>

      <MissionProgress campaignId={campaign.id} userId={user?.id} />

      {(mechanics.includes("geolocation") || mechanics.includes("treasure_hunt")) && campaign.status === "live" && (
        <div className="mb-6">
          <LocationCheckin campaignId={campaign.id} />
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
        />
      )}

      <div className="mt-12 flex justify-center gap-6 font-mono text-[10px] uppercase tracking-widest">
        <Link href="/discover" className="text-mute hover:text-volt">
          ← Field
        </Link>
        <Link href="/wallet" className="text-mute hover:text-volt">
          Collection →
        </Link>
      </div>
    </main>
  );
}
