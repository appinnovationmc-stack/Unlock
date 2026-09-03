import { PlayExperience } from "@/components/unlock/brand-studio/PlayExperience";
import { createClient } from "@/lib/supabase/server";
import { getMyOrgId } from "@/lib/actions/campaigns";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PlayCampaignPage({ params }: { params: { campaignId: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title, tagline, status, org_id, xp_value")
    .eq("id", params.campaignId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!campaign) notFound();

  const { data: reward } = await supabase
    .from("rewards")
    .select("label, value")
    .eq("campaign_id", params.campaignId)
    .limit(1)
    .maybeSingle();
  const rewardLabel = reward
    ? `${reward.label}${reward.value ? " — " + reward.value : ""}`
    : "Demo reward";

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 bg-void max-w-lg mx-auto">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-magenta mb-1">Play · demo</p>
          <h1 className="font-display text-2xl text-fog">{campaign.title}</h1>
          <p className="text-mute text-xs mt-1">No events written. Safe for sales and QA.</p>
        </div>
        <Link
          href={`/studio/live/${campaign.id}`}
          className="font-mono text-[10px] uppercase tracking-widest text-mute border border-white/10 px-2 py-1 hover:text-volt shrink-0"
        >
          LIVE
        </Link>
      </header>
      <PlayExperience
        title={campaign.title}
        tagline={campaign.tagline}
        rewardLabel={rewardLabel}
      />
      <p className="mt-8 text-center">
        <Link href={`/campaign/${campaign.id}`} className="font-mono text-[10px] uppercase tracking-widest text-volt hover:underline">
          Open real consumer experience →
        </Link>
      </p>
    </main>
  );
}
