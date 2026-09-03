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
      <nav className="flex items-center justify-between px-6 py-4 border-b border-black/10">
        {brand}
        <span className="text-sm text-mute">Set .env.local and restart</span>
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
    /* env */
  }

  const link = "text-sm text-mute hover:text-fog min-h-11 inline-flex items-center";
  const isBrand = role === "brand";
  const isCreator = role === "creator";
  const isAdmin = role === "admin";

  return (
    <nav className="unlock-glass sticky top-0 z-40 flex items-center justify-between px-6 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {brand}
      <div className="flex items-center gap-5 flex-wrap justify-end">
        <Link href="/discover" className={link}>
          {isBrand ? "Field" : "Explore"}
        </Link>
        {!user && (
          <>
            <Link href="/for-you" className={link}>
              You
            </Link>
            <Link href="/for-brands" className={link}>
              Brands
            </Link>
            <Link href="/for-creators" className={link}>
              Creators
            </Link>
          </>
        )}
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
        {role === "consumer" && user && (
          <>
            <Link href="/wallet" className={link}>
              Rewards
            </Link>
            <Link href="/profile" className={link}>
              You
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
