"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { AuthFields } from "@/components/auth/AuthFields";
import { Button } from "@/components/ui/Button";

const roles = [
  { value: "consumer", label: "Consumer" },
  { value: "creator", label: "Creator" },
  { value: "brand", label: "Brand" }
] as const;

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("consumer");

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-void">
      <form action={signUp} className="w-full max-w-sm">
        <p className="section-kicker mb-2">UNLOCK</p>
        <h1 className="font-display text-3xl text-fog mb-6">Create account</h1>
        {searchParams.error && (
          <p className="text-sm text-magenta mb-4">{searchParams.error}</p>
        )}

        <div className="flex gap-2 mb-6">
          {roles.map((r) => (
            <button
              type="button"
              key={r.value}
              onClick={() => setRole(r.value)}
              className={`flex-1 py-2 text-sm border transition-colors ${
                role === r.value
                  ? "border-volt text-volt"
                  : "border-white/10 text-mute hover:border-white/30"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="role" value={role} />

        <AuthFields handle={role !== "brand"} />

        <Button type="submit" variant="volt" className="w-full mt-2">
          Sign up as {role}
        </Button>

        <p className="mt-6 text-sm text-mute">
          Have an account?{" "}
          <Link href="/login" className="text-fog hover:text-volt">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
