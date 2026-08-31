import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-3xl mx-auto">
      <p className="font-mono text-xs uppercase tracking-widest text-magenta">Legal</p>
      <h1 className="font-display text-3xl text-fog mt-1 mb-8">Privacy Policy</h1>
      <div className="space-y-4 text-mute text-sm leading-relaxed">
        <p>
          Unlock ("we", "the platform") processes account data needed to run interactive
          advertising campaigns: email, role, organisation membership, campaign participation,
          reward claims, and attribution events.
        </p>
        <p>
          We do not sell personal data. Brands see aggregated and campaign-scoped analytics for
          campaigns they own. Creators see earnings tied to their referral activity.
        </p>
        <p>
          Payment data is processed by our payment provider (e.g. Paystack). We store payment
          references and ledger amounts; we do not store full card numbers.
        </p>
        <p>
          You may request account deletion by contacting the platform operator. Some financial
          records are retained as required for audit and legal compliance.
        </p>
        <p className="font-mono text-xs text-mute">
          This summary is a baseline disclosure. Replace with counsel-reviewed terms before
          enterprise contracts.
        </p>
      </div>
      <Link href="/" className="inline-block mt-10 font-mono text-xs uppercase tracking-widest text-volt">
        ← Home
      </Link>
    </main>
  );
}
