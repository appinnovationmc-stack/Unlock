import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { Button } from "@/components/ui/Button";
import { getPublicBrandProof } from "@/lib/unlock/proof/public";
import { unescapeHtmlEntities } from "@/lib/unlock/display-text";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UNLOCK — For brands",
  description:
    "Plant an encounter. People act. You see verified actions. Public proof from live campaigns."
};

function LockedStat({ label }: { label: string }) {
  return (
    <div className="border border-black/10 px-5 py-4">
      <p className="section-kicker">{label}</p>
      <p className="font-display text-xl text-mute mt-1">In Studio</p>
    </div>
  );
}

function PublicStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/10 px-5 py-4">
      <p className="section-kicker">{label}</p>
      <p className="font-display text-3xl text-fog mt-1 tabular-nums">{value}</p>
    </div>
  );
}

export default async function ForBrandsPage() {
  const proof = await getPublicBrandProof();
  const campaignHref = (
    proof.flagship ? `/campaign/${proof.flagship.id}` : "/discover"
  ) as Route;

  const flagshipTitle = proof.flagship
    ? unescapeHtmlEntities(proof.flagship.title)
    : "";
  const flagshipTagline = proof.flagship
    ? unescapeHtmlEntities(proof.flagship.tagline)
    : "";
  const flagshipDescription = proof.flagship
    ? unescapeHtmlEntities(proof.flagship.description)
    : "";

  return (
    <main className="min-h-screen bg-void">
      <div className="page-shell">
        <p className="section-kicker mb-4">For brands</p>
        <h1 className="font-display text-4xl md:text-6xl font-900 leading-[0.95] text-fog">
          Plant an encounter.
          <br />
          People act.
          <br />
          You <span className="text-volt">see</span> what happened.
        </h1>
        <p className="mt-6 text-mute text-base md:text-lg leading-relaxed">
          A brand plants a moment in the world. Someone finds it, completes it, and the action is
          verified.
        </p>

        <div className="mt-10 grid gap-6">
          {[
            ["01", "Plant", "Drop a moment where people already are."],
            ["02", "Act", "They go. They unlock."],
            ["03", "See", "Verified actions land in Studio."]
          ].map(([n, t, d]) => (
            <div key={n}>
              <p className="section-kicker">{n}</p>
              <p className="font-display text-fog mt-1">{t}</p>
              <p className="text-mute text-sm mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>

        <section className="mt-14 border border-black/10 p-6 md:p-8">
          <p className="section-kicker">Live now</p>
          <h2 className="font-display text-2xl text-fog mt-1">On the field</h2>

          <div className="grid grid-cols-2 gap-4 mt-6 mb-8">
            <PublicStat label="Live moments" value={String(proof.liveCampaignCount)} />
            <PublicStat label="Places" value={String(proof.livePinCount)} />
          </div>

          {proof.flagship ? (
            <div className="border border-black/10 px-5 py-5 mb-8">
              <p className="section-kicker mb-2">Happening now</p>
              <h3 className="font-display text-2xl md:text-3xl text-fog">{flagshipTitle}</h3>
              {flagshipTagline && (
                <p className="text-mute mt-2 leading-relaxed">{flagshipTagline}</p>
              )}
              {flagshipDescription && (
                <p className="text-fog/80 text-sm mt-3 leading-relaxed">{flagshipDescription}</p>
              )}
              {proof.flagshipReward && (
                <p className="mt-4 text-sm text-fog">
                  {proof.flagshipReward.label}
                  {proof.flagshipReward.value ? ` — ${proof.flagshipReward.value}` : ""}
                </p>
              )}
              <div className="mt-6">
                <Link href={campaignHref}>
                  <Button variant="volt">Open it</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="border border-black/10 px-5 py-6 mb-8">
              <p className="font-display text-fog">Nothing public on the field right now</p>
              <Link href="/discover" className="inline-block mt-4 text-sm text-mute hover:text-fog">
                Explore
              </Link>
            </div>
          )}

          <div>
            <p className="section-kicker mb-4">What you measure in Studio</p>
            <div className="grid gap-4">
              {proof.funnel.map((m) => (
                <LockedStat key={m.label} label={m.label} />
              ))}
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link href={"/signup?role=brand" as Route}>
            <Button variant="volt">Start</Button>
          </Link>
          <Link href={campaignHref}>
            <Button variant="ghost">See one live</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
