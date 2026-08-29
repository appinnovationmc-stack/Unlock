"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name")).trim();
  const industry = String(formData.get("industry") ?? "general").trim() || "general";

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name, industry, kind: "brand" })
    .select("id")
    .single();

  if (error || !org) {
    return redirect(`/onboarding?error=${encodeURIComponent(error?.message ?? "Could not create org")}`);
  }

  await supabase.from("org_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "owner"
  });

  redirect("/studio");
}
