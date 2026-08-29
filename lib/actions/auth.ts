"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AuthRole } from "@/lib/types";

export type { AuthRole };

// Signup only ever provisions these three self-service roles. "admin" is
// deliberately excluded — it must never be settable by the client, at
// signup or otherwise. See getCurrentRole() and admin_users (migration
// 00000008) for how admin is actually granted.
const SELF_SERVICE_SIGNUP_ROLES = new Set(["consumer", "creator", "brand"]);

function sanitizeSignupRole(raw: FormDataEntryValue | null): "consumer" | "creator" | "brand" {
  const value = String(raw ?? "consumer");
  return (SELF_SERVICE_SIGNUP_ROLES.has(value) ? value : "consumer") as
    | "consumer"
    | "creator"
    | "brand";
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const handle = String(formData.get("handle") ?? "").trim();
  const role = sanitizeSignupRole(formData.get("role"));

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        handle: handle || undefined
      }
    }
  });

  if (error) {
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (role === "brand" && data.user) {
    redirect("/onboarding");
  }

  if (role === "creator") {
    redirect("/dashboard");
  }

  redirect("/discover");
}

export async function logIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const user = data.user;
  if (!user) redirect("/discover");

  // Redirect target is UX only — resolved from real DB relationships, not
  // client-controlled metadata. Every destination page re-checks access
  // itself, so this is not an authorization decision.
  const role = await getCurrentRole();

  if (role === "admin") {
    redirect("/admin");
  }

  if (role === "brand") {
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    redirect(membership ? "/studio" : "/onboarding");
  }

  if (role === "creator") {
    redirect("/dashboard");
  }

  redirect("/discover");
}

export async function logOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email")).trim();
  if (!email) {
    return redirect(`/forgot-password?error=${encodeURIComponent("Email is required")}`);
  }

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_URL;
  const origin = siteUrl || (vercel ? `https://${vercel}` : "http://localhost:3000");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`
  });

  if (error) {
    return redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password"));
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?reset=1");
}

/**
 * Resolve current user role from real, RLS-protected tables only.
 *
 * Deliberately does NOT read auth.users.user_metadata.role: that field is
 * writable by the client at any time via supabase.auth.updateUser(), so
 * trusting it for authorization is a privilege-escalation hole (any user
 * could self-grant "admin"). admin_users, creators, and org_members are
 * all either service-role-only writes or scoped to the caller's own rows.
 */
export async function getCurrentRole(): Promise<AuthRole | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (admin) return "admin";

  const { data: creator } = await supabase
    .from("creators")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (creator) return "creator";

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership) return "brand";

  return "consumer";
}
