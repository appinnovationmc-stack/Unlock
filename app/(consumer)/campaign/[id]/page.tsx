import { UnlockClient } from "@/components/campaign/UnlockClient";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { ref?: string };
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
    : "Reward pending";

  const referrerCreatorId = searchParams.ref || null;

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-2xl mx-auto">
      {campaign.status !== "live" && (
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-gold border border-gold/30 px-3 py-2 inline-block">
          Preview · {campaign.status}
        </p>
      )}

      <p className="font-mono text-xs uppercase tracking-widest text-volt mb-3">
        {(campaign.mechanics ?? []).join(" · ") || "experience"}
        {campaign.objective ? ` · ${String(campaign.objective).replace(/_/g, " ")}` : ""}
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-fog mb-2">{campaign.title}</h1>
      {campaign.tagline && <p className="text-mute text-lg mb-4">{campaign.tagline}</p>}
      {campaign.description && (
        <p className="text-fog/80 text-sm mb-8 leading-relaxed">{campaign.description}</p>
      )}

      <UnlockClient
        campaignId={campaign.id}
        rewardLabel={rewardLabel}
        referrerCreatorId={referrerCreatorId}
      />

      <p className="mt-6 text-center font-mono text-xs text-mute">
        +{campaign.xp_value} XP on unlock
      </p>

      <div className="mt-10 flex justify-center gap-4 font-mono text-[10px] uppercase tracking-widest">
        <Link href="/discover" className="text-mute hover:text-volt">
          ← Discover
        </Link>
        <Link href="/wallet" className="text-mute hover:text-volt">
          Wallet →
        </Link>
      </div>
    </main>
  );
}
