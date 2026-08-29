import Link from "next/link";
import { logIn } from "@/lib/actions/auth";
import { AuthFields } from "@/components/auth/AuthFields";
import { Button } from "@/components/ui/Button";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-duotone">
      <form action={logIn} className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-fog mb-6">Log in</h1>
        {searchParams.error && (
          <p className="text-sm text-magenta mb-4">{searchParams.error}</p>
        )}
        <AuthFields />
        <Button type="submit" variant="volt" className="w-full justify-center mt-2">
          Log in
        </Button>
        <p className="mt-6 text-sm text-mute">
          No account?{" "}
          <Link href="/signup" className="text-volt hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
