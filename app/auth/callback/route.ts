import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), "/reset-password");
  const origin = url.origin;

  // Supabase redirects here directly with these params if verification failed
  // upstream (e.g. link already used/expired) — there is no `code` in that case.
  const supabaseError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (supabaseError) {
    console.error("[auth/callback] Supabase verify error:", supabaseError);
    return NextResponse.redirect(
      new URL(
        `/forgot-password?error=${encodeURIComponent(
          "This password reset link is invalid or has expired. Please request a new one."
        )}`,
        origin
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/forgot-password?error=${encodeURIComponent("Invalid or expired password reset link")}`,
        origin
      )
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      new URL(
        `/forgot-password?error=${encodeURIComponent("This password reset link is invalid or has expired")}`,
        origin
      )
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
