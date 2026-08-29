import { createOrganization } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/Button";

export default function OnboardingPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-duotone">
      <form action={createOrganization} className="w-full max-w-sm">
        <p className="font-mono text-xs uppercase tracking-widest text-magenta mb-2">Brand setup</p>
        <h1 className="font-display text-2xl text-fog mb-6">Name your organization</h1>
        {searchParams.error && <p className="text-sm text-magenta mb-4">{searchParams.error}</p>}

        <label className="block mb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">Organization name</span>
          <input
            name="name"
            required
            placeholder="e.g. NOVA"
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>
        <label className="block mb-6">
          <span className="font-mono text-xs uppercase tracking-widest text-mute">Industry</span>
          <input
            name="industry"
            placeholder="retail, music, fintech, events..."
            className="mt-1 w-full bg-ink2 border border-white/10 focus:border-volt px-4 py-3 text-fog outline-none"
          />
        </label>

        <Button type="submit" variant="volt" className="w-full justify-center">
          Create organization
        </Button>
      </form>
    </main>
  );
}
