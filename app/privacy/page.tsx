import Link from "next/link";
export default function PrivacyPage() {
  return <main className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
    <h1 className="text-3xl mb-6">Unlock privacy notice</h1>
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Maobane Innovations operates Unlock in South Africa. Privacy contact: <a href="mailto:support@maobaneinnovations.co.za">support@maobaneinnovations.co.za</a>. You can also submit a <Link href="/support">privacy or deletion request</Link>. Updated 14 November 2026.</p>
      <h2 className="text-xl">Information used to provide the service</h2>
      <p>We process your email, profile, organization membership, authentication sessions, campaign activity, referrals, reward claims, support requests, payment references and earnings. Device location, accuracy, distance and check-in times are stored when you attempt location verification. Risk signals derived from activity help identify suspicious claims. Location permission can be declined, but location-dependent campaigns will not verify.</p>
      <h2 className="text-xl">Who can see your information</h2>
      <p>Profile handles, public posts, photos, comments, reactions and follows can be visible to other people. Uploaded public media can be accessed by anyone with its URL. Do not publish sensitive information. Brands can access campaign-scoped participation records, user identifiers, verification evidence and risk reasons for their campaigns. Creators see their own earnings. Administrators access records needed for support, moderation and financial review.</p>
      <p>Supabase provides database, authentication and storage services; the production database is hosted in Ireland. Vercel hosts the application. Paystack processes payments. These services may process information outside South Africa. Unlock stores transaction references and amounts, not full payment-card numbers. We do not sell personal data.</p>
      <h2 className="text-xl">Notifications and cookies</h2>
      <p>Authentication cookies keep you signed in. Browser push subscriptions are stored only when you opt in; you can revoke permission in browser settings. Following another account can generate in-app notifications. Repeat-audience brand marketing notifications are not currently enabled.</p>
      <h2 className="text-xl">Retention, requests and deletion</h2>
      <p>Account and campaign records are retained while needed to provide the service and resolve outstanding rewards or disputes. Financial and fraud evidence may need to remain after account closure for accounting, legal or dispute obligations. A deletion request is reviewed before removal; we will explain records retained and the applicable period in our response. Public copies others have made may remain outside our control.</p>
      <p>You may request access, correction, objection to processing or account deletion through support. We verify account ownership before acting. Please provide your account email and request reference, but not passwords or full banking details. If you are dissatisfied with our response, you may contact South Africa’s Information Regulator.</p>
    </div><Link href="/" className="inline-block mt-8">Home</Link>
  </main>;
}
