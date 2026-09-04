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
          Don&apos;t just see the ad.
          <br />
          <span style={{ color: "#0071e3" }}>Unlock</span> it.
        </h1>
        <p className="text-mute text-lg mt-5 max-w-lg mx-auto">
          Brands plant moments in the city. People walk to them. Creators bring the crowd. Every step is counted.
        </p>
      </header>

      <section className="grid md:grid-cols-3 border-t border-black/10">
        <article className="flex flex-col items-center text-center px-8 py-16 md:border-r border-black/10">
          <h2 className="font-display text-3xl text-fog tracking-tight">You</h2>
          <p className="mt-3 text-mute">Find it. Get close. Unlock it.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/for-you">
              <Button variant="ghost">How it works</Button>
            </Link>
            <Link href="/discover">
              <Button variant="volt">Open the map</Button>
            </Link>
          </div>
        </article>
        <article className="flex flex-col items-center text-center px-8 py-16 md:border-r border-black/10 bg-ink">
          <h2 className="font-display text-3xl text-fog tracking-tight">Brands</h2>
          <p className="mt-3 text-mute">Plant a pin. Watch who came.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/for-brands">
              <Button variant="ghost">How it works</Button>
            </Link>
            <Link href="/studio">
              <Button variant="volt">Studio</Button>
            </Link>
          </div>
        </article>
        <article className="flex flex-col items-center text-center px-8 py-16">
          <h2 className="font-display text-3xl text-fog tracking-tight">Creators</h2>
          <p className="mt-3 text-mute">Paid for who showed up.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/for-creators">
              <Button variant="ghost">How it works</Button>
            </Link>
            <Link href="/signup?role=creator">
              <Button variant="volt">Start</Button>
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
