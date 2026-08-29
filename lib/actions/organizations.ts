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

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({
      name,
      industry,
      kind: "brand",
      description: description || null,
      website: website || null,
      logo_url: logoUrl
    })
    .select("id")
    .single();

  if (error || !org) {
    return redirect(
      `/onboarding?error=${encodeURIComponent(error?.message ?? "Could not create organization")}`
    );
  }

  await supabase.from("org_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "owner"
  });

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
