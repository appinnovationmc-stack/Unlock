"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AuthRole = "consumer" | "creator" | "brand";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const handle = String(formData.get("handle") ?? "").trim();
  const role = String(formData.get("role")) as AuthRole;

  const supabase = createClient();

  // Brand accounts don't get a consumers/creators row — they get an
  // organization instead, provisioned after signup below.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: role === "brand" ? "brand" : role, handle: handle || undefined }
    }
  });

  if (error) {
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (role === "brand" && data.user) {
    redirect("/onboarding");
  }

  redirect(role === "creator" ? "/dashboard" : "/discover");
}

export async function logIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/discover");
}

export async function logOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
