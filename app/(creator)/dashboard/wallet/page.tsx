import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/finance/money";
import { WithdrawalForm } from "./WithdrawalForm";

export const dynamic = "force-dynamic";

type Nested<T> = T | T[] | null;

type EarningRow = {
  id: string;
  amount_cents: number;
  status: string;
  earning_type: string | null;
  description: string | null;
  created_at: string;
  campaigns: Nested<{ title?: string | null }>;
};

function one<T>(value: Nested<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function sumCents(rows: EarningRow[], statuses: string[]): number {
  return rows.reduce((n, row) => {
    if (!statuses.includes(row.status)) return n;
    const cents = Number(row.amount_cents);
    return n + (Number.isFinite(cents) ? cents : 0);
  }, 0);
}

const EARNING_GROUPS: { title: string; statuses: string[] }[] = [
  { title: "Pending", statuses: ["pending"] },
  { title: "Available", statuses: ["available"] },
  { title: "Paid", statuses: ["paid"] },
  { title: "Reversed", statuses: ["reversed"] },
  { title: "Rejected", statuses: ["rejected"] }
];

export default async function CreatorWalletPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: creator } = await supabase
    .from("creators")
    .select("id, handle")
    .eq("id", user.id)
    .maybeSingle();

  if (!creator) redirect("/signup");

  const [earningsRes, withdrawalsRes] = await Promise.all([
    supabase
      .from("creator_earnings")
      .select("id, amount_cents, status, earning_type, description, created_at, campaigns(title)")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("creator_withdrawals")
      .select("*")
      .eq("creator_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(15)
  ]);

  const earnings = (earningsRes.data ?? []) as EarningRow[];
  const withdrawals = withdrawalsRes.data || [];

  const pendingCents = sumCents(earnings, ["pending"]);
  const availableCents = sumCents(earnings, ["available"]);
  const paidCents = sumCents(earnings, ["paid"]);
  const lifetimeEarnedCents = sumCents(earnings, ["pending", "available", "paid"]);

  const grouped = EARNING_GROUPS.map((group) => ({
    ...group,
    items: earnings.filter((e) => group.statuses.includes(e.status))
  })).filter((group) => group.items.length > 0);

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 max-w-4xl mx-auto bg-void">
      <header className="mb-8 flex flex-wrap justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-magenta">Creator wallet</p>
          <h1 className="font-display text-2xl text-fog mt-1">@{creator.handle}</h1>
          <p className="text-mute text-sm mt-2">
            Pending stays pending until a verified store visit. Available is withdrawable after
            that auto-verify.
          </p>
        </div>
        <Link href="/dashboard" className="font-mono text-xs text-volt">
          ← Dashboard
        </Link>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {[
          { label: "Available", value: formatMoney(availableCents), tone: "text-volt" },
          { label: "Pending", value: formatMoney(pendingCents), tone: "text-gold" },
          {
            label: "Lifetime earned",
            value: formatMoney(lifetimeEarnedCents),
            tone: "text-fog"
          },
          {
            label: "Lifetime paid",
            value: formatMoney(paidCents),
            tone: "text-mute"
          }
        ].map((s) => (
          <div key={s.label} className="clip-keyhole-sm bg-ink2 border border-white/5 px-4 py-3">
            <p className="font-mono text-[10px] text-mute">{s.label}</p>
            <p className={`font-display text-xl mt-1 ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </section>

      <section className="border border-white/5 p-5 mb-10">
        <h2 className="font-display text-lg text-fog mb-3">Request withdrawal</h2>
        <p className="text-mute text-sm mb-4">
          Minimum withdrawal is set by platform commercial rules (default R500). Funds must be
          available (verified).
        </p>
        <WithdrawalForm availableCents={availableCents} />
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg text-fog mb-4">Earnings</h2>
        {earnings.length === 0 ? (
          <p className="text-mute font-mono text-sm">
            No earnings yet. Share referral links from your dashboard — verified conversions create
            earnings.
          </p>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.title}>
                <p className="font-mono text-[10px] text-mute mb-3">{group.title}</p>
                <div className="border border-white/5 divide-y divide-white/5">
                  {group.items.map((e) => {
                    const title = one(e.campaigns)?.title || "Campaign";
                    return (
                      <div
                        key={e.id}
                        className="px-5 py-3 flex flex-wrap justify-between gap-2 text-sm"
                      >
                        <div>
                          <p className="text-fog font-display">{title}</p>
                          <p className="font-mono text-[10px] text-mute">
                            {e.earning_type} · {e.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-volt font-mono">+{formatMoney(e.amount_cents)}</p>
                          <p className="font-mono text-[10px] text-mute">{e.status}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg text-fog mb-4">Withdrawals</h2>
        {withdrawals.length === 0 ? (
          <p className="text-mute font-mono text-sm">No withdrawals yet.</p>
        ) : (
          <div className="border border-white/5 divide-y divide-white/5 font-mono text-xs">
            {withdrawals.map((w) => (
              <div key={w.id} className="px-5 py-3 flex flex-wrap justify-between gap-2">
                <span className="text-mute">{new Date(w.requested_at).toLocaleString()}</span>
                <span className="text-fog">{formatMoney(w.amount_cents)}</span>
                <span
                  className={
                    w.status === "paid"
                      ? "text-volt"
                      : w.status === "rejected" || w.status === "failed"
                        ? "text-magenta"
                        : "text-gold"
                  }
                >
                  {w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
