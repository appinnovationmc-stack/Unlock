import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/finance/money";
import { DepositForm } from "./DepositForm";
import { FundCampaignForm } from "./FundCampaignForm";

export const dynamic = "force-dynamic";

export default async function BrandBillingPage({
  searchParams
}: {
  searchParams: { payment?: string; sandbox?: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const orgId = membership.org_id;
  const orgName = (membership.organizations as { name?: string } | null)?.name || "Organisation";

  const [accountRes, budgetsRes, ledgerRes, intentsRes, campaignsRes] = await Promise.all([
    supabase.from("org_financial_accounts").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("campaign_budgets").select("*, campaigns(title)").eq("org_id", orgId),
    supabase
      .from("financial_ledger")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("payment_intents")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("campaigns")
      .select("id, title, status")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
  ]);

  const account = accountRes.data;
  const budgets = budgetsRes.data || [];
  const ledger = ledgerRes.data || [];
  const intents = intentsRes.data || [];
  const campaigns = campaignsRes.data || [];

  const available = account?.available_balance_cents ?? 0;
  const reserved = account?.reserved_balance_cents ?? 0;
  const lifetime = account?.lifetime_deposited_cents ?? 0;
  const spent = account?.lifetime_spent_cents ?? 0;

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-magenta">Billing</p>
          <h1 className="font-display text-2xl text-fog mt-1">{orgName}</h1>
          <p className="text-mute text-sm mt-2 max-w-xl">
            Deposit funds, allocate campaign budgets, and track every rand. Platform fees and creator
            spend are transparent.
          </p>
        </div>
        <Link href="/studio" className="font-mono text-xs text-volt hover:underline">
          ← Studio
        </Link>
      </header>

      {searchParams.payment === "success" && (
        <div className="mb-6 border border-volt/30 bg-volt/5 px-4 py-3 font-mono text-sm text-volt">
          Payment recorded
          {searchParams.sandbox === "1" ? " (sandbox / test mode)" : ""}. Balance updated.
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {[
          { label: "Available", value: formatMoney(available), tone: "text-volt" },
          { label: "Reserved", value: formatMoney(reserved), tone: "text-fog" },
          { label: "Lifetime deposited", value: formatMoney(lifetime), tone: "text-fog" },
          { label: "Lifetime spent", value: formatMoney(spent), tone: "text-mute" }
        ].map((s) => (
          <div key={s.label} className="clip-keyhole-sm bg-ink2 border border-white/5 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-mute">{s.label}</p>
            <p className={`font-display text-xl mt-1 ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </section>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <section className="border border-white/5 p-5">
          <h2 className="font-display text-lg text-fog mb-3">Deposit funds</h2>
          <p className="text-mute text-sm mb-4">
            Top up your organisation balance. Payments are verified server-side via the payment
            provider (Paystack for South Africa, or sandbox in test mode).
          </p>
          <DepositForm orgId={orgId} />
        </section>

        <section className="border border-white/5 p-5">
          <h2 className="font-display text-lg text-fog mb-3">Fund a campaign</h2>
          <p className="text-mute text-sm mb-4">
            Allocate budget from available balance. Platform fee is calculated from your commercial
            agreement. Campaign cannot spend beyond this budget.
          </p>
          <FundCampaignForm
            campaigns={campaigns.map((c) => ({ id: c.id, title: c.title, status: c.status }))}
          />
        </section>
      </div>

      <section className="mb-12">
        <h2 className="font-display text-lg text-fog mb-4">Campaign budgets</h2>
        {budgets.length === 0 ? (
          <p className="text-mute font-mono text-sm">No campaign budgets yet.</p>
        ) : (
          <div className="border border-white/5 divide-y divide-white/5">
            {budgets.map((b) => {
              const remaining =
                Number(b.total_budget_cents) - Number(b.spent_cents) - Number(b.reserved_cents);
              const title = (b.campaigns as { title?: string } | null)?.title || b.campaign_id;
              return (
                <div key={b.campaign_id} className="px-5 py-4 grid md:grid-cols-6 gap-2 text-sm">
                  <div className="md:col-span-2">
                    <p className="font-display text-fog">{title}</p>
                    <p className="font-mono text-[10px] text-mute uppercase">{b.status}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-mute">Total</p>
                    <p className="text-fog">{formatMoney(b.total_budget_cents)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-mute">Spent</p>
                    <p className="text-fog">{formatMoney(b.spent_cents)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-mute">Reserved</p>
                    <p className="text-fog">{formatMoney(b.reserved_cents)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] text-mute">Remaining</p>
                    <p className={remaining <= 0 ? "text-magenta" : "text-volt"}>
                      {formatMoney(remaining)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="font-display text-lg text-fog mb-4">Payment intents</h2>
        {intents.length === 0 ? (
          <p className="text-mute font-mono text-sm">No payments yet.</p>
        ) : (
          <div className="border border-white/5 divide-y divide-white/5 font-mono text-xs">
            {intents.map((i) => (
              <div key={i.id} className="px-5 py-3 flex flex-wrap justify-between gap-2">
                <span className="text-mute">{new Date(i.created_at).toLocaleString()}</span>
                <span className="text-fog">{formatMoney(i.amount_cents)}</span>
                <span className="text-mute">{i.provider}</span>
                <span
                  className={
                    i.status === "succeeded"
                      ? "text-volt"
                      : i.status === "failed"
                        ? "text-magenta"
                        : "text-gold"
                  }
                >
                  {i.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg text-fog mb-4">Ledger</h2>
        <p className="text-mute text-sm mb-3">
          Every financial change is recorded. Balances are derived from these entries.
        </p>
        {ledger.length === 0 ? (
          <p className="text-mute font-mono text-sm">No ledger entries yet.</p>
        ) : (
          <div className="border border-white/5 divide-y divide-white/5 font-mono text-xs">
            {ledger.map((e) => (
              <div key={e.id} className="px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <span className="text-mute">{new Date(e.created_at).toLocaleString()}</span>
                <span className="text-fog">{e.entry_type}</span>
                <span className={e.amount_cents >= 0 ? "text-volt" : "text-fog"}>
                  {formatMoney(e.amount_cents)}
                </span>
                <span className="text-mute truncate">{e.description}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
