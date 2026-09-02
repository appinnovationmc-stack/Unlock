import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage({
  searchParams
}: {
  searchParams: { error?: string; sent?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-void">
      <form action={requestPasswordReset} className="w-full max-w-sm">
        <p className="section-kicker mb-2">UNLOCK</p>
        <h1 className="font-display text-3xl text-fog mb-2">Reset password</h1>
        <p className="text-sm text-mute mb-6">
          Enter your email and we&apos;ll send a secure reset link.
        </p>
        {searchParams.error && (
          <p className="text-sm text-magenta mb-4">{searchParams.error}</p>
        )}
        {searchParams.sent && (
          <p className="text-sm text-fog mb-4">Check your inbox for the reset link.</p>
        )}
        <label className="block mb-4">
          <span className="block text-sm text-mute mb-1">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog text-base outline-none"
          />
        </label>
        <Button type="submit" variant="volt" className="w-full mt-2">
          Send reset link
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
