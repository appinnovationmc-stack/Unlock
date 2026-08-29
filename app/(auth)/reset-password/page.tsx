import Link from "next/link";
import { updatePassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-duotone">
      <form action={updatePassword} className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-fog mb-2">Set new password</h1>
        <p className="text-sm text-mute mb-6">Choose a strong password (min 6 characters).</p>
        {searchParams.error && (
          <p className="text-sm text-magenta mb-4">{searchParams.error}</p>
        )}
        <label className="block mb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>
        <Button type="submit" variant="volt" className="w-full justify-center mt-2">
          Update password
        </Button>
        <p className="mt-6 text-sm text-mute">
          <Link href="/login" className="text-volt hover:underline">
            Back to log in
          </Link>
        </p>
      </form>
    </main>
  );
}
