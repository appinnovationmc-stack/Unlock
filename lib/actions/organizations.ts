"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

  // Atomic: org insert + owner membership insert happen in one transaction
  // inside the RPC, so a mid-flow failure can never leave the org without
  // an owner. Also enforces one org per user server-side.
  const { data: org, error } = await supabase
    .rpc("create_organization", {
      p_name: name,
      p_industry: industry,
      p_description: description || null,
      p_website: website || null,
      p_logo_url: logoUrl
    })
    .single();

  if (error || !org) {
    return redirect(
      `/onboarding?error=${encodeURIComponent(error?.message ?? "Could not create organization")}`
    );
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

  // Explicit app-layer check, not just reliance on the RLS policy: keeps
  // this action safe even if the DB policy is ever loosened or dropped.
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!membership) {
    return redirect(`/studio?error=${encodeURIComponent("Not authorized to update this organization")}`);
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
