import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/Button";

export default function ForCreatorsPage() {
  return (
    <main className="page-shell min-h-screen">
      <p className="section-kicker">For creators</p>
      <h1 className="font-display text-4xl md:text-6xl text-fog tracking-tight mt-3">
        You get paid for who showed up.
        <br />
        Not for who follows you.
      </h1>
      <p className="text-mute text-lg mt-4 max-w-md">
        Join a live drop. Share your link. When someone walks and unlocks through you, that is the number.
      </p>
      <ol className="mt-10 space-y-6">
        {[
          ["Join", "Pick a live moment in Studio's field."],
          ["Send", "Your link is the only credit."],
          ["Prove", "Visits and unlocks land on your dashboard."],
          ["Take", "Wallet is what you earned. Withdraw when it is real."]
        ].map(([t, d]) => (
          <li key={t}>
            <p className="font-display text-xl text-fog">{t}</p>
            <p className="text-mute text-sm mt-1">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={"/signup?role=creator" as Route}>
          <Button variant="volt">Start as a creator</Button>
        </Link>
        <Link href="/discover">
          <Button variant="ghost">See the field</Button>
        </Link>
      </div>
    </main>
  );
}
