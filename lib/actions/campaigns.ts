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
  // datetime-local → "2026-08-29T18:00" — append Z-less local; store as ISO-ish
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
    startsAt,
    endsAt,
    heroImage,
    status
  };
}

export async function createCampaign(formData: FormData) {
  const supabase = createClient();
  const orgId = await getMyOrgId();
  if (!orgId) redirect("/onboarding");

  const f = parseCampaignForm(formData);

  if (!f.title) {
    return redirect(`/studio?error=${encodeURIComponent("Campaign title is required")}`);
  }

  const insertStatus = f.status === "live" ? "live" : "draft";
  const publishedAt = insertStatus === "live" ? new Date().toISOString() : null;

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      title: f.title,
      tagline: f.tagline || null,
      description: f.description || null,
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

  revalidatePath("/studio");
  revalidatePath("/discover");

  if (insertStatus === "draft") {
    redirect(`/studio?created=${campaign.id}&draft=1`);
  }
  redirect(`/studio?created=${campaign.id}`);
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

  const updates: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "live") {
    updates.published_at = new Date().toISOString();
    updates.paused_at = null;
  }
  if (nextStatus === "paused") {
    updates.paused_at = new Date().toISOString();
  }

  if (nextStatus === "live") {
    const { data: c } = await supabase
      .from("campaigns")
      .select("title, mechanics")
      .eq("id", campaignId)
      .eq("org_id", orgId)
      .single();
    if (!c?.title) {
      return redirect(`/studio?error=${encodeURIComponent("Cannot publish: missing title")}`);
    }
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

/** Add a map pin / store location to a campaign (PostGIS point). */
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

  // PostGIS geography point via raw SQL RPC-friendly insert
  const { error } = await supabase.rpc("add_campaign_location_point", {
    p_org_id: orgId,
    p_campaign_id: campaignId,
    p_label: label,
    p_lng: lng,
    p_lat: lat,
    p_radius_m: Number.isFinite(radiusM) ? Math.max(25, Math.min(5000, radiusM)) : 150
  });

  // Fallback if RPC missing: try direct insert with WKT-style via from
  if (error) {
    // Store as metadata-only fallback using a text workaround isn't ideal;
    // require migration 00000021 for the RPC.
    redirect(
      `/studio?error=${encodeURIComponent(error.message || "Could not add location — apply migration 00000021")}`
    );
  }

  revalidatePath("/studio");
  revalidatePath(`/studio/live/${campaignId}`);
  revalidatePath(`/campaign/${campaignId}`);
  redirect("/studio?created=location");
}
