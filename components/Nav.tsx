import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut, getCurrentRole } from "@/lib/actions/auth";

export async function Nav() {
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasEnv) {
    return (
      <nav className="flex items-center justify-between px-6 py-4 border-b border-magenta/30 bg-magenta/10">
        <Link href="/" aria-label="Home" className="font-display text-sm text-fog tracking-tight">
          UNLOCK
        </Link>
        <span className="text-sm text-magenta">
          Set .env.local (Supabase URL + anon key) and restart npm run dev
        </span>
      </nav>
    );
  }

  let user = null as { email?: string } | null;
  let role: string | null = null;

  try {
    const supabase = createClient();
    const {
      data: { user: u }
    } = await supabase.auth.getUser();
    user = u;
    if (u) role = await getCurrentRole();
  } catch {
    // env misconfigured mid-request
  }

  const link = "text-sm text-mute hover:text-fog motion-safe:transition-colors";

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-void/90 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
      <Link href="/" aria-label="Home" className="font-display text-sm text-fog tracking-tight">
        UNLOCK
      </Link>
      <div className="flex items-center gap-5 flex-wrap justify-end">
        <Link href="/discover" className={link}>
          Field
        </Link>
        {(!user || role === "brand") && (
          <Link href="/for-brands" className={link}>
            Brands
          </Link>
        )}
        {(role === "brand" || !user) && (
          <Link href="/studio" className={link}>
            Studio
          </Link>
        )}
        {(role === "creator" || !user) && (
          <Link href="/dashboard" className={link}>
            Creator
          </Link>
        )}
        {role === "consumer" && (
          <>
            <Link href="/impact" className={link}>
              Impact
            </Link>
            <Link href="/profile" className={link}>
              Profile
            </Link>
            <Link href="/wallet" className={link}>
              Wallet
            </Link>
          </>
        )}
        {role === "admin" && (
          <Link href="/admin" className={link}>
            Admin
          </Link>
        )}
        {user ? (
          <form action={logOut}>
            <button type="submit" className={`${link} truncate max-w-[140px]`}>
              {user.email?.split("@")[0]} · Out
            </button>
          </form>
        ) : (
          <Link href="/login" className={link}>
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
