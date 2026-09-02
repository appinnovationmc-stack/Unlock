import Link from "next/link";
import { updatePassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-void">
      <form action={updatePassword} className="w-full max-w-sm">
        <p className="section-kicker mb-2">UNLOCK</p>
        <h1 className="font-display text-3xl text-fog mb-2">Set new password</h1>
        <p className="text-sm text-mute mb-6">Choose a strong password (min 6 characters).</p>
        {searchParams.error && (
          <p className="text-sm text-magenta mb-4">{searchParams.error}</p>
        )}
        <label className="block mb-4">
          <span className="block text-sm text-mute mb-1">New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog text-base outline-none"
          />
        </label>
        <Button type="submit" variant="volt" className="w-full mt-2">
          Update password
        </Button>
        <p className="mt-6 text-sm text-mute">
          <Link href="/login" className="hover:text-fog">
            Back to log in
          </Link>
        </p>
      </form>
    </main>
  );
}
