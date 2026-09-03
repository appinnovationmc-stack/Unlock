import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { UnlockMark } from "@/components/ui/UnlockMark";

export default function Home() {
  return (
    <main className="min-h-screen bg-void">
      <header className="px-6 pt-16 pb-10 md:pt-24 md:pb-12 text-center">
        <div className="flex justify-center mb-6">
          <UnlockMark size={56} />
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-900 leading-[0.95] tracking-tight text-fog">
          Don't just see the ad.
          <br />
          <span style={{ color: "#0071e3" }}>Unlock</span> it.
        </h1>
      </header>

      <section className="grid md:grid-cols-2 border-t border-black/10">
        <article className="flex flex-col items-center text-center px-8 py-20 md:py-28 md:border-r border-black/10">
          <h2 className="font-display text-4xl md:text-5xl text-fog tracking-tight">Explore</h2>
          <p className="mt-3 text-mute text-lg">Find it. Get close. Unlock it.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/discover">
              <Button variant="volt">Something is waiting</Button>
            </Link>
            <Link href="/signup">
              <Button variant="ghost">Create account</Button>
            </Link>
          </div>
        </article>

        <article className="flex flex-col items-center text-center px-8 py-20 md:py-28 bg-ink">
          <h2 className="font-display text-4xl md:text-5xl text-fog tracking-tight">Studio</h2>
          <p className="mt-3 text-mute text-lg">Plant a moment. Watch who came.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/for-brands">
              <Button variant="volt">Learn more</Button>
            </Link>
            <Link href="/studio">
              <Button variant="ghost">Build</Button>
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
