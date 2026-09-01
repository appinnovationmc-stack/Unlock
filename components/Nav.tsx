import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut, getCurrentRole } from "@/lib/actions/auth";

export async function Nav() {
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasEnv) {
    return (
      <nav className="flex items-center justify-between px-6 py-3 border-b border-magenta/40 bg-magenta/10 font-mono text-xs uppercase tracking-widest">
        <Link href="/" className="text-fog font-display tracking-normal text-sm">
          UNLOCK
        </Link>
        <span className="text-magenta normal-case tracking-normal">
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

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-white/5 font-mono text-xs uppercase tracking-widest">
      <Link href="/" className="text-fog font-display tracking-normal text-sm">
        UNLOCK
      </Link>
      <div className="flex items-center gap-3 sm:gap-4 text-mute flex-wrap justify-end">
        <Link href="/discover" className="hover:text-volt">
          Discover
        </Link>
        {(role === "brand" || !user) && (
          <Link href="/studio" className="hover:text-volt">
            Studio
          </Link>
        )}
        {(role === "creator" || !user) && (
          <Link href="/dashboard" className="hover:text-volt">
            Creator
          </Link>
        )}
        {role === "consumer" && (
          <Link href="/impact" className="hover:text-volt">
            Impact
          </Link>
          <Link href="/wallet" className="hover:text-volt">
            Wallet
          </Link>
        )}
        {role === "admin" && (
          <Link href="/admin" className="hover:text-volt">
            Admin
          </Link>
        )}
        {user ? (
          <form action={logOut}>
            <button type="submit" className="hover:text-magenta truncate max-w-[140px]">
              {user.email?.split("@")[0]} · Out
            </button>
          </form>
        ) : (
          <Link href="/login" className="hover:text-volt">
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
