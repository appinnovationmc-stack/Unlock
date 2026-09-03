import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNLOCK — The participation layer",
  description:
    "Advertising moved from attention to clicks. UNLOCK measures the next layer: verified human action."
};

export default function ForAgenciesPage() {
  return (
    <main className="page-shell min-h-screen max-w-2xl">
      <p className="section-kicker mb-3">For agencies</p>
      <h1 className="font-display text-4xl md:text-5xl text-fog mb-6 leading-tight">
        The participation layer for advertising.
      </h1>
      <p className="text-mute text-lg mb-10 leading-relaxed">
        Traditional: impression → click.
        <br />
        UNLOCK: discover → visit → verify → participate → unlock → redeem → measure.
      </p>

      <section className="space-y-8 mb-12">
        <div>
          <p className="section-kicker">The problem</p>
          <p className="text-fog mt-2 leading-relaxed">
            The room loves the work. Reach looks like a skyline. Then the client asks: did anyone
            actually go? That silence is the hole.
          </p>
        </div>
        <div>
          <p className="section-kicker">What UNLOCK is</p>
          <p className="text-fog mt-2 leading-relaxed">
            Brands plant experiences on a live map. People walk there. The platform verifies the
            act. Rewards and creator pay follow proof — not follower count.
          </p>
        </div>
        <div>
          <p className="section-kicker">What you can prove</p>
          <p className="text-fog mt-2 leading-relaxed">
            Who came. What they did. Where it happened. Which creator drove it. What it cost per
            verified visit. What it produced.
          </p>
        </div>
        <div>
          <p className="section-kicker">Why now</p>
          <p className="text-fog mt-2 leading-relaxed">
            Attention is rented. Participation can be verified. Agencies that can prove a body in a
            store will price differently from agencies that can only prove a view.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/demo" className="text-volt hover:underline">
          The only demo path
        </Link>
        <Link href="/for-brands" className="text-mute hover:text-fog">
          For brands
        </Link>
        <Link href="/discover" className="text-mute hover:text-fog">
          Open the field
        </Link>
      </div>
    </main>
  );
}
