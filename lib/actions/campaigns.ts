"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { CampaignMechanicType, CampaignStatus } from "@/lib/types";

export async function getMyOrgId() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return data?.org_id ?? null;
}

function parseDateInput(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseCampaignForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim() || null;
  const targetAudience = String(formData.get("target_audience") ?? "").trim() || null;
  const xp = Number(formData.get("xp_value") ?? 100);
  const mechanics = formData.getAll("mechanics") as CampaignMechanicType[];
  const rewardLabel = String(formData.get("reward_label") ?? "").trim();
  const rewardValue = String(formData.get("reward_value") ?? "").trim();
  const verify = String(formData.get("verify") ?? "session").trim() || "session";
  const where = String(formData.get("where") ?? "").trim() || null;
  const startsAt =
    parseDateInput(String(formData.get("starts_at") ?? "")) ?? new Date().toISOString();
  const endsAt = parseDateInput(String(formData.get("ends_at") ?? ""));
  const heroImage = String(formData.get("hero_image_url") ?? "").trim() || null;
  const status = (String(formData.get("status") ?? "draft") as CampaignStatus) || "draft";

  return {
    title,
    tagline,
    description,
    objective,
    targetAudience,
    xp: Number.isFinite(xp) ? xp : 100,
    mechanics,
    rewardLabel,
    rewardValue,
    verify,
    where,
    startsAt,
    endsAt,
    heroImage,
    status
  };
}

function verificationRequired(verify: string): string[] {
  if (verify === "location") return ["location"];
  if (verify === "qr") return ["qr"];
  if (verify === "nfc") return ["nfc"];
  if (verify === "product") return ["product"];
  return ["authenticated_session"];
}

export async function createCampaign(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const f = parseCampaignForm(formData);

  if (!f.title) {
    return redirect(`/studio?error=${encodeURIComponent("Campaign title is required")}`);
  }

  const wantedLive = f.status === "live";
  if (wantedLive && !f.rewardLabel) {
    return redirect(
      `/studio?error=${encodeURIComponent("Name the reward before going live")}`
    );
  }

  // New campaigns have no pins yet — live is a second step after LocationForm.
  const insertStatus: CampaignStatus = "draft";
  const publishedAt = null;

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      title: f.title,
      tagline: f.tagline || null,
      description: f.description || f.tagline || null,
      objective: f.objective,
      target_audience: f.targetAudience,
      mechanics: f.mechanics,
      xp_value: f.xp,
      status: insertStatus,
      starts_at: f.startsAt,
      ends_at: f.endsAt,
      hero_image_url: f.heroImage,
      cover_image_url: f.heroImage,
      published_at: publishedAt
    })
    .select("id")
    .single();

  if (error || !campaign) {
    return redirect(
      `/studio?error=${encodeURIComponent(error?.message ?? "Could not create campaign")}`
    );
  }

  if (f.rewardLabel) {
    await supabase.from("rewards").insert({
      org_id: orgId,
      campaign_id: campaign.id,
      type: "discount",
      label: f.rewardLabel,
      value: f.rewardValue || f.rewardLabel
    });
  }

  const objectiveToType: Record<string, string> = {
    discover: "DISCOVER",
    visit: "VISIT",
    play: "PLAY",
    solve: "SOLVE",
    review: "REVIEW",
    share: "SHARE",
    collect: "COLLECT",
    buy: "BUY",
    store_visits: "VISIT",
    product_discovery: "DISCOVER",
    engagement: "PLAY",
    awareness: "DISCOVER",
    customer_acquisition: "BUY",
    promotions: "COLLECT",
    competitions: "PLAY",
    loyalty: "COLLECT",
    product_launch: "DISCOVER",
    creator_campaign: "SHARE",
    lead_generation: "SHARE"
  };
  const primaryType =
    objectiveToType[(f.objective ?? "").toLowerCase()] ??
    (f.mechanics.includes("geolocation" as CampaignMechanicType)
      ? "VISIT"
      : f.mechanics.includes("qr_scan" as CampaignMechanicType) ||
          f.mechanics.includes("treasure_hunt" as CampaignMechanicType)
        ? "COLLECT"
        : f.mechanics.includes("quiz" as CampaignMechanicType) ||
            f.mechanics.includes("puzzle" as CampaignMechanicType)
          ? "SOLVE"
          : "PLAY");

  try {
    await supabase.from("experience_configs").insert({
      campaign_id: campaign.id,
      organisation_id: orgId,
      primary_type: primaryType,
      verification_required: verificationRequired(f.verify),
      reward_preview: {
        label: f.rewardLabel || null,
        value: f.rewardValue || null
      },
      map_visible: true,
      config: {
        objective: f.objective,
        mechanics: f.mechanics,
        where: f.where,
        verify: f.verify,
        source: "experience_builder"
      }
    });
  } catch {
    /* table may not exist yet */
  }

  revalidatePath("/studio");
  revalidatePath("/discover");

  if (wantedLive) {
    redirect(
      `/studio?created=${campaign.id}&draft=1&error=${encodeURIComponent(
        "Saved as draft. Add a map pin, then publish."
      )}`
    );
  }
  redirect(`/studio?created=${campaign.id}&draft=1`);
}

async function assertCanGoLive(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  campaignId: string
) {
  const { data: c } = await supabase
    .from("campaigns")
    .select("title")
    .eq("id", campaignId)
    .eq("org_id", orgId)
    .single();
  if (!c?.title) {
    return "Cannot publish: missing title";
  }
  const { count: pinCount } = await supabase
    .from("campaign_locations")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("org_id", orgId);
  if (!pinCount) {
    return "Add a map pin before going live";
  }
  const { data: reward } = await supabase
    .from("rewards")
    .select("label")
    .eq("campaign_id", campaignId)
    .limit(1)
    .maybeSingle();
  if (!reward?.label?.trim()) {
    return "Name the reward before going live";
  }
  return null;
}

export async function updateCampaignStatus(formData: FormData) {
  const campaignId = String(formData.get("campaign_id"));
  const nextStatus = String(formData.get("status")) as CampaignStatus;

  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const allowed: CampaignStatus[] = ["draft", "scheduled", "live", "paused", "ended", "archived"];
  if (!allowed.includes(nextStatus)) {
    return redirect(`/studio?error=${encodeURIComponent("Invalid status")}`);
  }

  if (nextStatus === "live") {
    const blocked = await assertCanGoLive(supabase, orgId, campaignId);
    if (blocked) {
      return redirect(`/studio?error=${encodeURIComponent(blocked)}`);
    }
  }

  const updates: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "live") {
    updates.published_at = new Date().toISOString();
    updates.paused_at = null;
  }
  if (nextStatus === "paused") {
    updates.paused_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", campaignId)
    .eq("org_id", orgId);

  if (error) {
    return redirect(`/studio?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/studio");
  revalidatePath("/discover");
  revalidatePath(`/campaign/${campaignId}`);
  revalidatePath(`/studio/live/${campaignId}`);
  if (nextStatus === "live") {
    redirect(`/studio/live/${campaignId}`);
  }
  redirect("/studio");
}

export async function saveDraftCampaign(formData: FormData) {
  formData.set("status", "draft");
  return createCampaign(formData);
}

export async function publishCampaign(formData: FormData) {
  formData.set("status", "live");
  return createCampaign(formData);
}

export async function addCampaignLocation(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const radiusM = Number(formData.get("radius_m") ?? 150);

  if (!campaignId || !label || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    redirect(`/studio?error=${encodeURIComponent("Location needs label, lat, and lng")}`);
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!campaign) {
    redirect(`/studio?error=${encodeURIComponent("Campaign not found")}`);
  }

  const { error } = await supabase.rpc("add_campaign_location_point", {
    p_org_id: orgId,
    p_campaign_id: campaignId,
    p_label: label,
    p_lng: lng,
    p_lat: lat,
    p_radius_m: Number.isFinite(radiusM) ? Math.max(25, Math.min(5000, radiusM)) : 150
  });

  if (error) {
    redirect(
      `/studio?error=${encodeURIComponent(error.message || "Could not add location — apply migration 00000021")}`
    );
  }

  revalidatePath("/studio");
  revalidatePath(`/studio/live/${campaignId}`);
  revalidatePath(`/campaign/${campaignId}`);
  redirect(`/studio?created=${campaignId}&pin=1`);
}

export async function addCampaignReward(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();

  if (!campaignId || !label) {
    redirect(`/studio?error=${encodeURIComponent("Reward needs a name")}`);
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!campaign) {
    redirect(`/studio?error=${encodeURIComponent("Campaign not found")}`);
  }

  const { error } = await supabase.from("rewards").insert({
    org_id: orgId,
    campaign_id: campaignId,
    type: "discount",
    label,
    value: value || label
  });

  if (error) {
    redirect(`/studio?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/studio");
  revalidatePath(`/campaign/${campaignId}`);
  redirect(`/studio?created=${campaignId}&reward=1`);
}

export async function removeCampaignLocation(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const locationId = String(formData.get("location_id") ?? "").trim();
  if (!locationId) redirect("/studio?error=" + encodeURIComponent("Missing location"));

  const { error } = await supabase
    .from("campaign_locations")
    .delete()
    .eq("id", locationId)
    .eq("org_id", orgId);

  if (error) {
    redirect(`/studio?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/studio");
  revalidatePath("/discover");
  redirect("/studio?created=location_removed");
}
