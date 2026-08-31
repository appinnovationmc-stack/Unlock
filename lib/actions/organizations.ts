"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Brand onboarding: atomic org + owner membership via SECURITY DEFINER RPC.
 * Prevents race conditions and enforces one-org-per-user.
 */
export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name")).trim();
  const industry = String(formData.get("industry") ?? "general").trim() || "general";
  const description = String(formData.get("description") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim() || null;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!name) {
    return redirect(`/onboarding?error=${encodeURIComponent("Organization name is required")}`);
  }

  const { data, error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_industry: industry,
    p_description: description || null,
    p_website: website || null,
    p_logo_url: logoUrl
  });

  if (error) {
    return redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  // RPC returns setof — handle array or single
  const orgId = Array.isArray(data) ? data[0]?.id : (data as { id?: string })?.id;
  if (!orgId) {
    return redirect(`/onboarding?error=${encodeURIComponent("Could not create organization")}`);
  }

  revalidatePath("/studio");
  redirect("/studio");
}

export async function updateOrganization(formData: FormData) {
  const orgId = String(formData.get("org_id"));
  const name = String(formData.get("name")).trim();
  const industry = String(formData.get("industry") ?? "general").trim() || "general";
  const description = String(formData.get("description") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim() || null;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!membership) {
    return redirect(`/studio?error=${encodeURIComponent("Not authorised for this organisation")}`);
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      industry,
      description: description || null,
      website: website || null,
      logo_url: logoUrl
    })
    .eq("id", orgId);

  if (error) {
    return redirect(`/studio?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/studio");
  redirect("/studio");
}
