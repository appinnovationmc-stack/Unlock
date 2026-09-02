import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="min-h-screen bg-void flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="section-kicker mb-6">Encounters · not ads</p>

      <h1 className="font-display text-5xl md:text-7xl font-900 leading-[0.95] text-fog max-w-4xl">
        Don&apos;t just see the ad.
        <br />
        <span className="text-volt">Unlock</span> it.
      </h1>

      <p className="mt-6 max-w-lg text-mute text-base md:text-lg leading-relaxed">
        Brands plant experiences in the world. You find them, complete them, claim the
        reward — then pass it on. Creators amplify. The platform measures what actually
        happened.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row gap-3">
        <Link href="/discover">
          <Button variant="volt">Enter the field</Button>
        </Link>
        <Link href="/for-brands">
          <Button variant="ghost">For brands</Button>
        </Link>
      </div>
      <p className="mt-4 text-sm text-mute">
        <Link href="/signup" className="hover:text-fog">
          Create account
        </Link>
      </p>

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl text-left w-full">
        {[
          ["01", "Encounter", "Something appears — a drop, a hunt, a challenge."],
          ["02", "Act", "You play. Not scroll. Not fill a form."],
          ["03", "Broadcast", "Reward in hand. Share it. Creators get paid for real reach."]
        ].map(([n, t, d]) => (
          <div key={n} className="border border-white/10 bg-ink2/40 px-5 py-4 clip-keyhole-sm">
            <p className="section-kicker">{n}</p>
            <p className="font-display text-fog mt-1">{t}</p>
            <p className="text-mute text-sm mt-2 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-sm text-mute">
        <Link href="/studio" className="hover:text-fog">
          Brands → Studio
        </Link>
        {" · "}
        <Link href="/dashboard" className="hover:text-fog">
          Creators
        </Link>
      </p>
    </main>
  );
}
