import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-3xl mx-auto">
      <p className="font-mono text-xs uppercase tracking-widest text-magenta">Legal</p>
      <h1 className="font-display text-3xl text-fog mt-1 mb-8">Terms of Use</h1>
      <div className="space-y-4 text-mute text-sm leading-relaxed">
        <p>
          Unlock is an interactive advertising and engagement platform. Brands fund campaigns;
          consumers participate to unlock rewards; creators may earn for verified referrals.
        </p>
        <p>
          Campaign rewards are subject to campaign rules, stock limits, expiry, and anti-fraud
          controls. Unlock may withhold or reverse rewards and earnings tied to abuse, self-referral,
          or fabricated events.
        </p>
        <p>
          Platform fees and commercial terms are defined in organisation agreements and campaign
          budgets. Creator withdrawals are subject to verification, minimum amounts, and payout
          processing times.
        </p>
        <p>
          You must not attempt to escalate privileges, access other organisations&apos; data, manipulate
          balances, or forge attribution.
        </p>
        <p className="font-mono text-xs text-mute">
          Baseline terms only. Obtain legal review before first paid enterprise campaign.
        </p>
      </div>
      <Link href="/" className="inline-block mt-10 font-mono text-xs uppercase tracking-widest text-volt">
        ← Home
      </Link>
    </main>
  );
}
