import Link from "next/link";
export default function TermsPage() {
  return <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
    <h1 className="text-3xl mb-6">Unlock terms of use</h1>
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Unlock is operated by Maobane Innovations in South Africa. Contact <a href="mailto:support@maobaneinnovations.co.za">support@maobaneinnovations.co.za</a> or use our <Link href="/support">support form</Link>. Updated 14 November 2026.</p>
      <h2 className="text-xl">Participation and rewards</h2>
      <p>Campaigns specify eligibility, location, required actions, available rewards and dates. Rewards are limited by stock and the expiry shown in your wallet. A location check uses information from your device and may require review. Do not fabricate visits, referrals, purchases or verification evidence.</p>
      <p>A reward is fulfilled by its merchant. Generate a token only when you are ready to collect; the token lasts ten minutes. Generating a token does not use up the reward. The merchant records redemption when providing the reward. If a merchant refuses a valid reward, keep your claim reference and contact support.</p>
      <h2 className="text-xl">Brand funding and campaign charges</h2>
      <p>All launch balances and prices are in South African rand. Only settled payments create available funds. The platform fee and creator, reward and performance allocations are shown before funding. Platform fees are separate from the amount available for campaign delivery. Creator compensation and verified visit charges use their respective allocations.</p>
      <p>Closing a campaign returns unused service funds to the brand balance after pending earnings are resolved. This is not a bank refund. Request a bank refund through support; approved refunds are returned through the payment provider and may take additional bank processing time. Fees already earned and delivered services are subject to the agreed campaign terms and applicable consumer rights. Funding a closed campaign requires a new campaign.</p>
      <h2 className="text-xl">Creator earnings and manual payouts</h2>
      <p>Earnings remain pending until verified. Withdrawals require the displayed minimum balance, identity and destination checks. Payouts are processed manually by bank transfer; requesting a withdrawal does not mean a transfer has occurred. Unlock records a payout as paid only after an administrator records a verified bank receipt. Contact support for payout status or to provide banking information through an agreed secure channel; never post full bank details publicly.</p>
      <h2 className="text-xl">Safety, disputes and access</h2>
      <p>Suspicious activity, disputed payments and unreconciled test funds may be held for review. We may restrict abusive accounts and moderate public content. You can request review through support. Report unauthorized access promptly. Do not access another organization’s data or manipulate balances.</p>
      <p>Campaign-specific agreements must be accepted before paid delivery begins. Nothing here removes rights that cannot lawfully be excluded under South African law. Questions, complaints and refund requests can be submitted with a campaign or transaction reference through support.</p>
    </div><Link href="/" className="inline-block mt-8">Home</Link>
  </main>;
}
