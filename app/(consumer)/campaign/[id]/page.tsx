import { UnlockClient } from "@/components/campaign/UnlockClient";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!campaign) return notFound();

  const { data: reward } = await supabase
    .from("rewards")
    .select("label, value")
    .eq("campaign_id", params.id)
    .limit(1)
    .maybeSingle();

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-2xl mx-auto">
      <p className="font-mono text-xs uppercase tracking-widest text-volt mb-3">
        {campaign.mechanics?.join(" · ")}
      </p>
      <h1 className="font-display text-3xl text-fog mb-2">{campaign.title}</h1>
      <p className="text-mute mb-8">{campaign.tagline}</p>

      <UnlockClient
        campaignId={campaign.id}
        rewardLabel={reward ? `${reward.label}${reward.value ? " — " + reward.value : ""}` : "Reward pending"}
      />

      <p className="mt-6 text-center font-mono text-xs text-mute">
        +{campaign.xp_value} XP on unlock
      </p>
    </main>
  );
}
