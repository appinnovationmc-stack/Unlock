import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/reset-password";
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const origin = url.origin;

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
    return NextResponse.redirect(
      new URL(
        `/forgot-password?error=${encodeURIComponent("This password reset link is invalid or has expired")}`,
        origin
      )
    );
  }

  return NextResponse.redirect(new URL(next, origin));
}
