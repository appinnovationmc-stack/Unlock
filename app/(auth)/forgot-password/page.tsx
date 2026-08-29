import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage({
  searchParams
}: {
  searchParams: { error?: string; sent?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-duotone">
      <form action={requestPasswordReset} className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-fog mb-2">Reset password</h1>
        <p className="text-sm text-mute mb-6">
          Enter your email and we&apos;ll send a secure reset link.
        </p>
        {searchParams.error && (
          <p className="text-sm text-magenta mb-4">{searchParams.error}</p>
        )}
        {searchParams.sent && (
          <p className="text-sm text-volt mb-4">
            Check your inbox for the reset link.
          </p>
        )}
        <label className="block mb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">Email</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>
        <Button type="submit" variant="volt" className="w-full justify-center mt-2">
          Send reset link
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
