import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNLOCK — Demo path",
  description: "The only path to show: plant a pin, walk there, verify, unlock, watch LIVE move."
};

export default function DemoPage() {
  return (
    <main className="page-shell min-h-screen max-w-2xl">
      <p className="section-kicker mb-3">Publicis / Ogilvy / field</p>
      <h1 className="font-display text-4xl text-fog mb-4">Show the field. Not the deck.</h1>
      <p className="text-mute text-lg mb-10 leading-relaxed">
        One path. If any step fails, stop talking and fix that step. Do not demo push, NFC, or
        creator bank payouts unless those rails are live.
      </p>

      <ol className="space-y-6 text-fog">
        <li>
          <p className="section-kicker">1 · Brand</p>
          <p className="mt-1">
            <Link href="/studio" className="text-volt hover:underline">Studio</Link>
            {" "}— create the experience. Pin a real place. Name a real reward.
          </p>
        </li>
        <li>
          <p className="section-kicker">2 · Money</p>
          <p className="mt-1">
            <Link href="/billing" className="text-volt hover:underline">Billing</Link>
            {" "}— deposit, then fund with a performance slice. Visit CPE only bills if that
            slice exists (or an offer rate). Default is R20 per verified check-in.
          </p>
        </li>
        <li>
          <p className="section-kicker">3 · Publish</p>
          <p className="mt-1">Live. Pin must appear on Discover.</p>
        </li>
        <li>
          <p className="section-kicker">4 · Creator (optional)</p>
          <p className="mt-1">
            <Link href="/dashboard" className="text-volt hover:underline">Creator</Link>
            {" "}— copy the referral link. Open the campaign with <span className="font-mono text-sm">?ref=</span>.
          </p>
        </li>
        <li>
          <p className="section-kicker">5 · Consumer</p>
          <p className="mt-1">
            <Link href="/discover" className="text-volt hover:underline">Discover</Link>
            {" "}— stand on the pin. Check in. Hold. Reward lands in{" "}
            <Link href="/wallet" className="text-volt hover:underline">wallet</Link>.
          </p>
        </li>
        <li>
          <p className="section-kicker">6 · Proof</p>
          <p className="mt-1">
            Studio LIVE — people, visits, visit spend, remaining budget, which creator drove it.
          </p>
        </li>
      </ol>

      <p className="mt-12 text-sm text-mute leading-relaxed">
        Do not say creators are paid into FNB. Withdrawals are requested in-app and completed by
        an admin until Paystack Transfer is on. Do not say notifications work unless VAPID keys
        are set.
      </p>
    </main>
  );
}
