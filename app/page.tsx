import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="min-h-screen bg-duotone flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-mute mb-6">
        The infrastructure for interactive marketing
      </p>
      <h1 className="font-display text-5xl md:text-7xl font-900 leading-[0.95] text-fog max-w-4xl">
        DON'T JUST SEE THE AD.
        <br />
        <span className="text-volt text-glow-volt">UNLOCK IT.</span>
      </h1>
      <p className="mt-6 max-w-md text-mute">
        Campaigns you play, not scroll past. Brands, creators and consumers,
        closed into one loop.
      </p>
      <div className="mt-10 flex gap-4">
        <Link href="/discover">
          <Button variant="volt">Discover campaigns</Button>
        </Link>
        <Link href="/studio">
          <Button variant="ghost">Brand studio</Button>
        </Link>
      </div>
    </main>
  );
}
