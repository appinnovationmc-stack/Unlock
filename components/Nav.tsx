import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut, getCurrentRole } from "@/lib/actions/auth";
import { UnlockMark } from "@/components/ui/UnlockMark";

export async function Nav() {
  const hasEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const brand = (
    <Link href="/" aria-label="UNLOCK home" className="flex items-center gap-2 min-h-11">
      <UnlockMark size={28} />
      <span className="font-display text-sm text-fog tracking-tight">UNLOCK</span>
    </Link>
  );

  if (!hasEnv) {
    return (
      <nav className="flex items-center justify-between px-6 py-4 border-b border-magenta/30 bg-magenta/10">
        {brand}
        <span className="text-sm text-magenta">Set .env.local and restart</span>
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

  const link = "text-sm text-mute hover:text-fog motion-safe:transition-colors min-h-11 inline-flex items-center";
  const isBrand = role === "brand";
  const isCreator = role === "creator";
  const isAdmin = role === "admin";
  const isConsumer = role === "consumer" || (!user && !isBrand);

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 border-b border-black/5 bg-void/90 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
      {brand}
      <div className="flex items-center gap-5 flex-wrap justify-end">
        <Link href="/discover" className={link}>
          {isBrand ? "Field" : "Explore"}
        </Link>
        {isBrand && (
          <Link href="/studio" className={link}>
            Studio
          </Link>
        )}
        {isCreator && (
          <Link href="/dashboard" className={link}>
            Creator
          </Link>
        )}
        {isAdmin && (
          <Link href="/admin" className={link}>
            Admin
          </Link>
        )}
        {(isConsumer || role === "consumer") && user && (
          <>
            <Link href="/wallet" className={link}>
              Rewards
            </Link>
            <Link href="/profile" className={link}>
              Profile
            </Link>
          </>
        )}
        {user ? (
          <form action={logOut}>
            <button type="submit" className={link}>
              Out
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
