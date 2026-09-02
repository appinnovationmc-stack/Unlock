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
    "Plant an encounter. People act. You see verified actions. Public proof from live campaigns — not a manifesto."
};

function LockedStat({ label }: { label: string }) {
  return (
    <div className="border border-white/10 px-5 py-4">
      <p className="section-kicker">{label}</p>
      <p className="font-display text-xl text-mute mt-1">Locked</p>
      <p className="text-sm text-mute mt-2 leading-relaxed">
        Studio-only · not public under RLS
      </p>
    </div>
  );
}

function PublicStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 px-5 py-4">
      <p className="section-kicker">{label}</p>
      <p className="font-display text-3xl text-fog mt-1 tabular-nums">{value}</p>
    </div>
  );
}

export default async function ForBrandsPage() {
  const proof = await getPublicBrandProof();
  // Dynamic campaign id widens to string; cast keeps typedRoutes happy (same pattern as other Unlock deep links).
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
        <p className="section-kicker mb-4">For brands · public proof</p>
        <h1 className="font-display text-4xl md:text-6xl font-900 leading-[0.95] text-fog">
          Plant an encounter.
          <br />
          People act.
          <br />
          You <span className="text-volt">see</span> what happened.
        </h1>
        <p className="mt-6 text-mute text-base md:text-lg leading-relaxed">
          Unlock is participatory ads. Not impressions. A brand plants a moment in the world.
          Someone finds it, completes it, and the action is verified. Studio LIVE is the
          backstage. This page is what a CMO can open without logging in.
        </p>

        <div className="mt-10 grid gap-6">
          {[
            ["01", "Plant", "Drop an encounter — a hunt, a visit, a challenge — where people already are."],
            ["02", "Act", "They play. Not scroll. Location, scan, unlock — a completed moment."],
            ["03", "Prove", "Verified actions land in LIVE. Public proof here is only what RLS allows."]
          ].map(([n, t, d]) => (
            <div key={n}>
              <p className="section-kicker">{n}</p>
              <p className="font-display text-fog mt-1">{t}</p>
              <p className="text-mute text-sm mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>

        <section className="mt-14 border border-white/10 p-6 md:p-8">
          <p className="section-kicker">Proof · live field</p>
          <h2 className="font-display text-2xl text-fog mt-1">What is actually live</h2>
          <p className="text-sm text-mute mt-2 leading-relaxed">
            Counts below are public reads. Funnel numbers stay locked.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-6 mb-8">
            <PublicStat label="Live campaigns" value={String(proof.liveCampaignCount)} />
            <PublicStat label="Public map pins" value={String(proof.livePinCount)} />
          </div>

          {proof.flagship ? (
            <div className="border border-white/10 px-5 py-5 mb-8">
              <p className="section-kicker mb-2">
                Flagship
                {proof.flagshipPrimaryType ? ` · ${proof.flagshipPrimaryType}` : ""}
              </p>
              <h3 className="font-display text-2xl md:text-3xl text-fog">
                {flagshipTitle}
              </h3>
              {flagshipTagline && (
                <p className="text-mute mt-2 leading-relaxed">{flagshipTagline}</p>
              )}
              {flagshipDescription && (
                <p className="text-fog/80 text-sm mt-3 leading-relaxed">
                  {flagshipDescription}
                </p>
              )}
              {proof.flagshipReward && (
                <p className="mt-4 text-sm text-fog">
                  Reward · {proof.flagshipReward.label}
                  {proof.flagshipReward.value ? ` — ${proof.flagshipReward.value}` : ""}
                </p>
              )}
              {proof.flagshipPins.length > 0 ? (
                <ul className="mt-4 space-y-1">
                  {proof.flagshipPins.map((pin) => (
                    <li key={pin.location_id} className="text-sm text-mute">
                      {unescapeHtmlEntities(pin.label)}
                      <span className="text-mute/70"> · {pin.radius_m}m radius</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 section-kicker">
                  No public pin returned for this campaign yet
                </p>
              )}
              <div className="mt-6">
                <Link href={campaignHref}>
                  <Button variant="volt">Open the encounter</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="border border-white/10 px-5 py-6 mb-8">
              <p className="font-display text-fog">Flagship not public right now</p>
              <p className="text-mute text-sm mt-2 leading-relaxed">
                Unlock the flavour only appears here when it is live — the same rule as Discover.
                Drafts and other orgs’ Studio stay private.
              </p>
              <Link href="/discover" className="inline-block mt-4 text-sm text-mute hover:text-fog">
                See the field →
              </Link>
            </div>
          )}

          <div>
            <p className="section-kicker mb-2">LIVE funnel · compact</p>
            <p className="text-mute text-sm mb-4 leading-relaxed">
              Participant, unlock, and verified-visit totals live in Studio LIVE. They are not
              readable without org membership. Showing a lock instead of a zero.
            </p>
            <div className="grid gap-4">
              {proof.funnel.map((m) => (
                <LockedStat key={m.label} label={m.label} />
              ))}
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link href={"/signup?role=brand" as Route}>
            <Button variant="volt">Brand signup</Button>
          </Link>
          <Link href={campaignHref}>
            <Button variant="ghost">See a live campaign</Button>
          </Link>
        </div>
        <p className="mt-6 text-sm text-mute">
          No pricing on this page · no invented ROI · Studio remains behind login
        </p>
      </div>
    </main>
  );
}
