"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AuthRole } from "@/lib/types";

export type { AuthRole };

export async function signUp(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const handle = String(formData.get("handle") ?? "").trim();
  const role = String(formData.get("role")) as AuthRole;

  const supabase = createClient();

  // Never accept client-claimed admin on signup
  const safeRole = role === "admin" ? "consumer" : role;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: safeRole === "brand" ? "brand" : safeRole,
        handle: handle || undefined
      }
    }
  });

  if (error) {
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (safeRole === "brand" && data.user) {
    redirect("/onboarding");
  }

  if (safeRole === "creator") {
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

  const role = await getCurrentRole();

  if (role === "admin") redirect("/admin");
  if (role === "brand") {
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    redirect(membership ? "/studio" : "/onboarding");
  }
  if (role === "creator") redirect("/dashboard");
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

  // Note: no query string here on purpose. Supabase's redirect allowlist
  // requires an exact match (or an explicit wildcard entry), and
  // /auth/callback already defaults to /reset-password when `next` is
  // absent, so this stays as a plain URL that matches the allowlisted
  // https://unlock-alpha.vercel.app/auth/callback entry.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`
  });

  if (error) {
    return redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return redirect(
      `/reset-password?error=${encodeURIComponent("Password must be at least 6 characters")}`
    );
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect(
      `/forgot-password?error=${encodeURIComponent(
        "Your password reset session has expired. Please request a new link."
      )}`
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?reset=1");
}

/**
 * Resolve role from server-side sources only.
 * Admin is ONLY from admin_users table (service-role writable).
 * Never trust user_metadata.role for admin.
 */
export async function getCurrentRole(): Promise<AuthRole | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminRow) return "admin";

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

  const metaRole = user.user_metadata?.role as string | undefined;
  if (metaRole === "brand") return "brand";
  if (metaRole === "creator") return "creator";

  return "consumer";
}
