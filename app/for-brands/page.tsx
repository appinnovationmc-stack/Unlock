import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { Button } from "@/components/ui/Button";
import { getPublicBrandProof } from "@/lib/unlock/proof/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UNLOCK — For brands",
  description:
    "Plant an encounter. People act. You see verified actions. Public proof from live campaigns — not a manifesto."
};

function LockedStat({ label }: { label: string }) {
  return (
    <div className="border border-white/10 bg-ink2/50 px-5 py-4 clip-keyhole-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-mute">{label}</p>
      <p className="font-display text-xl text-mute mt-1">Locked</p>
      <p className="font-mono text-[10px] text-mute mt-2 leading-relaxed">
        Studio-only · not public under RLS
      </p>
    </div>
  );
}

function PublicStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-volt/25 bg-volt/5 px-5 py-4 clip-keyhole-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-volt">{label}</p>
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

  return (
    <main className="min-h-screen bg-duotone px-6 py-12 md:px-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(ellipse_at_top,_rgba(198,255,61,0.1),_transparent_55%)]" />

      <div className="relative max-w-4xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-volt mb-4">
          For brands · public proof
        </p>
        <h1 className="font-display text-4xl md:text-6xl font-900 leading-[0.95] text-fog max-w-3xl">
          Plant an encounter.
          <br />
          People act.
          <br />
          <span className="text-volt text-glow-volt">You see what happened.</span>
        </h1>
        <p className="mt-6 max-w-xl text-mute text-base md:text-lg leading-relaxed">
          UNLOCK is participatory ads. Not impressions. A brand plants a moment in the world.
          Someone finds it, completes it, and the action is verified. Studio LIVE is the
          backstage. This page is what a CMO can open without logging in.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            ["01", "Plant", "Drop an encounter — a hunt, a visit, a challenge — where people already are."],
            ["02", "Act", "They play. Not scroll. Location, scan, unlock — a completed moment."],
            ["03", "Prove", "Verified actions land in LIVE. Public proof here is only what RLS allows."]
          ].map(([n, t, d]) => (
            <div key={n} className="border border-white/10 bg-ink2/40 px-5 py-4 clip-keyhole-sm">
              <p className="font-mono text-[10px] text-volt tracking-widest">{n}</p>
              <p className="font-display text-fog mt-1">{t}</p>
              <p className="text-mute text-xs mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>

        <section className="mt-14 border border-white/10 bg-ink2/40 p-6 md:p-8 clip-keyhole">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt">
                Proof · live field
              </p>
              <h2 className="font-display text-2xl text-fog mt-1">What is actually live</h2>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute max-w-xs sm:text-right">
              Counts below are public reads. Funnel numbers stay locked.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <PublicStat label="Live campaigns" value={String(proof.liveCampaignCount)} />
            <PublicStat label="Public map pins" value={String(proof.livePinCount)} />
          </div>

          {proof.flagship ? (
            <div className="border border-volt/20 bg-void/50 px-5 py-5 mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-volt animate-pulse" />
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt">
                  Flagship
                  {proof.flagshipPrimaryType ? ` · ${proof.flagshipPrimaryType}` : ""}
                </p>
              </div>
              <h3 className="font-display text-2xl md:text-3xl text-fog">
                {proof.flagship.title}
              </h3>
              {proof.flagship.tagline && (
                <p className="text-mute mt-2 leading-relaxed">{proof.flagship.tagline}</p>
              )}
              {proof.flagship.description && (
                <p className="text-fog/80 text-sm mt-3 leading-relaxed max-w-2xl">
                  {proof.flagship.description}
                </p>
              )}
              {proof.flagshipReward && (
                <p className="mt-4 font-mono text-xs text-gold">
                  Reward · {proof.flagshipReward.label}
                  {proof.flagshipReward.value ? ` — ${proof.flagshipReward.value}` : ""}
                </p>
              )}
              {proof.flagshipPins.length > 0 ? (
                <ul className="mt-4 space-y-1">
                  {proof.flagshipPins.map((pin) => (
                    <li key={pin.location_id} className="font-mono text-xs text-mute">
                      Pin · {pin.label}
                      <span className="text-mute/70"> · {pin.radius_m}m radius</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-mute">
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
                “Unlock the flavour” only appears here when it is live — the same rule as Discover.
                Drafts and other orgs’ Studio stay private.
              </p>
              <Link href="/discover" className="inline-block mt-4 font-mono text-[10px] uppercase tracking-widest text-volt hover:underline">
                See the field →
              </Link>
            </div>
          )}

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-mute mb-2">
              LIVE funnel · compact
            </p>
            <p className="text-mute text-xs mb-4 max-w-2xl">
              Participant, unlock, and verified-visit totals live in Studio LIVE. They are not
              readable without org membership. Showing a lock instead of a zero.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {proof.funnel.map((m) => (
                <LockedStat key={m.label} label={m.label} />
              ))}
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link href={"/signup?role=brand" as Route}>
            <Button variant="volt">Brand signup</Button>
          </Link>
          <Link href={campaignHref}>
            <Button variant="ghost">See a live campaign</Button>
          </Link>
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-mute">
          No pricing on this page · no invented ROI · Studio remains behind login
        </p>
      </div>
    </main>
  );
}
