"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getPaymentProvider, isProductionPaymentsEnabled } from "@/lib/payments";
import { assertPositiveCents, formatMoney } from "@/lib/finance/money";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

async function requireOrgMember(orgId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Not a member of this organisation");
  return { supabase, user, role: data.role };
}

/** Create a payment intent to top-up org balance or fund a campaign */
export async function initiateBrandDeposit(params: {
  orgId: string;
  amountCents: number;
  campaignId?: string;
  purpose?: "top_up" | "campaign_funding" | "invoice_payment";
  customerEmail?: string;
}) {
  try {
    assertPositiveCents(params.amountCents);
    const { supabase, user } = await requireOrgMember(params.orgId);

    const provider = getPaymentProvider();
    const idempotencyKey = `dep_${params.orgId}_${params.amountCents}_${randomUUID().slice(0, 8)}`;

    const init = await provider.createPayment({
      amountCents: params.amountCents,
      currency: "ZAR",
      purpose: params.purpose || "top_up",
      orgId: params.orgId,
      campaignId: params.campaignId,
      description: params.campaignId
        ? `Campaign funding ${formatMoney(params.amountCents)}`
        : `Unlock balance top-up ${formatMoney(params.amountCents)}`,
      customerEmail: params.customerEmail,
      idempotencyKey,
      callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/billing?payment=return`,
      metadata: {
        user_id: user.id
      }
    });

    if (!init.success) {
      return { error: init.error || "Payment initiation failed" };
    }

    const { data: intent, error } = await supabase
      .from("payment_intents")
      .insert({
        org_id: params.orgId,
        campaign_id: params.campaignId || null,
        amount_cents: params.amountCents,
        currency: "ZAR",
        purpose: params.purpose || "top_up",
        status: "pending",
        provider: provider.name,
        provider_reference: init.providerReference,
        provider_client_secret: init.clientSecret || null,
        idempotency_key: idempotencyKey,
        description: params.campaignId ? "Campaign funding" : "Balance top-up",
        created_by: user.id,
        metadata: { is_sandbox: provider.isSandbox }
      })
      .select("id")
      .single();

    if (error) {
      return { error: error.message };
    }

    return {
      paymentIntentId: intent.id,
      authorizationUrl: init.authorizationUrl,
      providerReference: init.providerReference,
      isSandbox: provider.isSandbox,
      productionEnabled: isProductionPaymentsEnabled()
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Deposit failed" };
  }
}

/** Fund a campaign budget from org available balance (after deposit settled) */
export async function fundCampaignBudgetAction(params: {
  campaignId: string;
  totalBudgetCents: number;
  creatorAllocationCents?: number;
  rewardAllocationCents?: number;
  performanceAllocationCents?: number;
}) {
  try {
    assertPositiveCents(params.totalBudgetCents);
    const { supabase, user } = await requireUser();

    const { data, error } = await supabase.rpc("fund_campaign_budget", {
      p_campaign_id: params.campaignId,
      p_total_budget_cents: params.totalBudgetCents,
      p_creator_allocation_cents: params.creatorAllocationCents ?? 0,
      p_reward_allocation_cents: params.rewardAllocationCents ?? 0,
      p_performance_allocation_cents: params.performanceAllocationCents ?? 0,
      p_currency: "ZAR"
    });

    if (error) return { error: error.message };

    revalidatePath("/studio");
    revalidatePath("/billing");
    revalidatePath(`/campaign/${params.campaignId}`);

    return { success: true, campaignId: data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Funding failed" };
  }
}

/** Creator requests withdrawal */
export async function requestWithdrawalAction(amountCents: number, destinationMasked?: string) {
  try {
    assertPositiveCents(amountCents);
    const { supabase } = await requireUser();

    const { data, error } = await supabase.rpc("request_creator_withdrawal", {
      p_amount_cents: amountCents,
      p_destination_masked: destinationMasked || null
    });

    if (error) return { error: error.message };

    revalidatePath("/dashboard");
    revalidatePath("/wallet");

    return { success: true, withdrawalId: data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Withdrawal failed" };
  }
}

/** Load brand financial snapshot */
export async function getBrandFinancials(orgId: string) {
  try {
    const { supabase } = await requireOrgMember(orgId);

    const [account, budgets, ledger, intents, invoices] = await Promise.all([
      supabase.from("org_financial_accounts").select("*").eq("org_id", orgId).maybeSingle(),
      supabase.from("campaign_budgets").select("*").eq("org_id", orgId),
      supabase
        .from("financial_ledger")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("payment_intents")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("invoices")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    return {
      account: account.data,
      budgets: budgets.data || [],
      ledger: ledger.data || [],
      paymentIntents: intents.data || [],
      invoices: invoices.data || []
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load financials" };
  }
}

/** Creator wallet + earnings */
export async function getCreatorWallet() {
  try {
    const { supabase, user } = await requireUser();

    const [wallet, earnings, withdrawals] = await Promise.all([
      supabase.from("creator_wallets").select("*").eq("creator_id", user.id).maybeSingle(),
      supabase
        .from("creator_earnings")
        .select("*, campaigns(title)")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("creator_withdrawals")
        .select("*")
        .eq("creator_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(20)
    ]);

    return {
      wallet: wallet.data || {
        pending_cents: 0,
        available_cents: 0,
        lifetime_earned_cents: 0,
        lifetime_paid_cents: 0
      },
      earnings: earnings.data || [],
      withdrawals: withdrawals.data || []
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load wallet" };
  }
}

/** Admin / platform revenue aggregates (service-role or admin only in practice) */
export async function getPlatformRevenueSummary(fromIso?: string, toIso?: string) {
  try {
    const { supabase, user } = await requireUser();

    // Basic admin gate via user_metadata
    const role = (user.user_metadata as { role?: string })?.role;
    if (role !== "admin") {
      return { error: "Admin only" };
    }

    let ledgerQuery = supabase
      .from("financial_ledger")
      .select("entry_type, amount_cents, status, created_at");

    if (fromIso) ledgerQuery = ledgerQuery.gte("created_at", fromIso);
    if (toIso) ledgerQuery = ledgerQuery.lte("created_at", toIso);

    const { data: ledger } = await ledgerQuery;

    const rows = ledger || [];
    const sum = (type: string) =>
      rows.filter((r) => r.entry_type === type && r.status === "completed").reduce((a, r) => a + Number(r.amount_cents), 0);

    const platformFees = sum("platform_fee");
    const creatorPayouts = Math.abs(sum("withdrawal"));
    const rewardCosts = Math.abs(sum("reward_cost"));
    const deposits = sum("brand_deposit");
    const campaignFunding = Math.abs(sum("campaign_funding"));

    return {
      grossCampaignVolumeCents: campaignFunding,
      platformRevenueCents: platformFees,
      creatorPayoutsCents: creatorPayouts,
      rewardExpenditureCents: rewardCosts,
      refundsCents: Math.abs(sum("refund")),
      netPlatformRevenueCents: platformFees - rewardCosts, // simplified
      depositsCents: deposits,
      transactionCount: rows.length
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Revenue summary failed" };
  }
}
