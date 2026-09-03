import Link from "next/link";
import { logIn } from "@/lib/actions/auth";
import { AuthFields } from "@/components/auth/AuthFields";
import { Button } from "@/components/ui/Button";
import { safeNextPath } from "@/lib/auth/safe-next";
import { UnlockMark } from "@/components/ui/UnlockMark";

export default function LoginPage({
  searchParams
}: {
  searchParams: { error?: string; reset?: string; next?: string; redirect?: string };
}) {
  const next = safeNextPath(searchParams.next ?? searchParams.redirect, "");

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-void">
      <form action={logIn} className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <UnlockMark size={48} />
        </div>
        <h1 className="font-display text-3xl text-fog mb-2 text-center">Welcome back</h1>
        <p className="text-mute text-sm mb-6 text-center">Something may be waiting nearby.</p>
        {searchParams.error && (
          <p className="text-sm text-magenta mb-4">{searchParams.error}</p>
        )}
        {searchParams.reset && (
          <p className="text-sm text-fog mb-4">Password updated. You can log in now.</p>
        )}
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <AuthFields />
        <Button type="submit" variant="volt" className="w-full mt-2">
          Continue
        </Button>
        <p className="mt-4 text-sm text-mute text-center">
          <Link href="/forgot-password" className="hover:text-fog">
            Forgot password?
          </Link>
        </p>
        <p className="mt-3 text-sm text-mute text-center">
          New here?{" "}
          <Link href="/signup" className="text-fog hover:text-volt">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
