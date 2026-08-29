import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logOut } from "@/lib/actions/auth";

export async function Nav() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-white/5 font-mono text-xs uppercase tracking-widest">
      <Link href="/" className="text-fog">
        UNLOCK
      </Link>
      <div className="flex items-center gap-4 text-mute">
        <Link href="/discover" className="hover:text-volt">Discover</Link>
        <Link href="/studio" className="hover:text-volt">Studio</Link>
        <Link href="/dashboard" className="hover:text-volt">Creator</Link>
        {user ? (
          <form action={logOut}>
            <button className="hover:text-magenta">{user.email} · Log out</button>
          </form>
        ) : (
          <Link href="/login" className="hover:text-volt">Log in</Link>
        )}
      </div>
    </nav>
  );
}
