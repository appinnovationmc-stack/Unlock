import { createOrganization } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/studio");

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-duotone">
      <form action={createOrganization} className="w-full max-w-md">
        <p className="font-mono text-xs uppercase tracking-widest text-magenta mb-2">
          Brand onboarding
        </p>
        <h1 className="font-display text-3xl text-fog mb-2">Join Unlock</h1>
        <p className="text-mute text-sm mb-8">
          Create your brand space. You&apos;ll publish interactive campaigns people actually
          participate in — not just scroll past.
        </p>

        {searchParams.error && (
          <p className="text-sm text-magenta mb-4">{searchParams.error}</p>
        )}

        <label className="block mb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">
            Brand / organisation name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. NOVA"
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>

        <label className="block mb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">Industry</span>
          <input
            name="industry"
            placeholder="retail, music, fintech, events, FMCG…"
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>

        <label className="block mb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">
            Short description
          </span>
          <textarea
            name="description"
            rows={3}
            placeholder="What does your brand stand for?"
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none resize-none"
          />
        </label>

        <label className="block mb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">Website</span>
          <input
            name="website"
            type="url"
            placeholder="https://"
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>

        <label className="block mb-8">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">
            Logo URL (optional)
          </span>
          <input
            name="logo_url"
            type="url"
            placeholder="https://…/logo.png"
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>

        <Button type="submit" variant="volt" className="w-full justify-center">
          Enter Brand Studio
        </Button>
      </form>
    </main>
  );
}
