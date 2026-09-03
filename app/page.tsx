import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="min-h-screen bg-void flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="section-kicker mb-6">Encounters · not ads</p>

      <h1 className="font-display text-5xl md:text-7xl font-900 leading-[0.95] text-fog max-w-4xl">
        Don't just see the ad.
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

      <p className="mt-16 text-sm text-mute max-w-md leading-relaxed">
        Find it on the map. Get close. Hold to unlock.
      </p>

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
