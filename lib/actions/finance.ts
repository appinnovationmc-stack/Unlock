"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, isProductionPaymentsEnabled } from "@/lib/payments";
import { assertPositiveCents, formatMoney } from "@/lib/finance/money";
import { getCurrentRole } from "@/lib/actions/auth";

async function requireUser() {
  const supabase = await createClient();
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
    const idempotencyKey = `${provider.isSandbox ? "sandbox" : "dep"}_${randomUUID()}`;
    // Persist the reference before contacting the provider so early webhooks can settle it.
    const { data: intentId, error: intentError } = await supabase.rpc("create_deposit_intent", {
      p_org_id: params.orgId, p_amount_cents: params.amountCents,
      p_campaign_id: params.campaignId || null, p_reference: idempotencyKey,
      p_provider: provider.name, p_is_sandbox: provider.isSandbox
    });
    if (intentError) throw new Error(intentError.message);
    const init = await provider.createPayment({
      amountCents: params.amountCents, currency: "ZAR", purpose: "top_up",
      orgId: params.orgId, campaignId: params.campaignId,
      description: `Unlock balance top-up ${formatMoney(params.amountCents)}`,
      customerEmail: user.email, idempotencyKey,
      callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/billing?payment=return`,
      metadata: { user_id: user.id }
    });
    if (!init.success) return { error: init.error || "Payment initiation failed", paymentIntentId: intentId };
    if (init.providerReference !== idempotencyKey) throw new Error("Payment provider reference mismatch");
    const admin = createAdminClient();
    if (!admin) throw new Error("Payment service unavailable");
    const { error: saveError } = await admin.from("payment_intents").update({
      provider_client_secret: init.clientSecret || null
    }).eq("id", intentId);
    if (saveError) throw new Error(saveError.message);

    return {
      paymentIntentId: intentId,
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
    await requireUser();

    const supabase = await createClient();
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
    revalidatePath("/dashboard/wallet");

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

    for (const result of [account, budgets, ledger, intents, invoices]) {
      if (result.error) throw new Error(result.error.message);
    }
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

    for (const result of [wallet, earnings, withdrawals]) {
      if (result.error) throw new Error(result.error.message);
    }
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

/** Real per-campaign analytics for Brand Studio — no placeholders, all from campaign_analytics view */
export async function getOrgCampaignAnalytics(orgId: string) {
  try {
    const { supabase } = await requireOrgMember(orgId);

    const { data, error } = await supabase
      .from("campaign_analytics")
      .select("*")
      .eq("org_id", orgId)
      .order("campaign_id", { ascending: true });

    if (error) return { error: error.message };

    return { analytics: data || [] };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load analytics" };
  }
}

/** Single-campaign analytics — used on the campaign detail page */
export async function getCampaignAnalytics(campaignId: string) {
  try {
    const { supabase, user } = await requireUser();

    // Confirm the caller has access: either an org member of the owning org, or admin
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("org_id")
      .eq("id", campaignId)
      .maybeSingle();

    if (!campaign) return { error: "Campaign not found" };

    const role = await getCurrentRole();
    if (role !== "admin") {
      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("org_id", campaign.org_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!membership) return { error: "Not authorised for this campaign" };
    }

    const { data, error } = await supabase
      .from("campaign_analytics")
      .select("*")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (error) return { error: error.message };

    return { analytics: data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load campaign analytics" };
  }
}

/** Admin: move a withdrawal from requested -> processing */
export async function adminStartWithdrawalProcessing(withdrawalId: string) {
  try {
    const role = await getCurrentRole();
    if (role !== "admin") return { error: "Admin only" };

    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("admin_start_withdrawal_processing", {
      p_withdrawal_id: withdrawalId
    });

    if (error) return { error: error.message };

    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to start processing" };
  }
}

/** Admin: mark a withdrawal paid (requested or processing -> paid) */
export async function adminCompleteWithdrawal(
  withdrawalId: string,
  providerReference?: string,
  payoutProvider?: string
) {
  try {
    const role = await getCurrentRole();
    if (role !== "admin") return { error: "Admin only" };

    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("admin_complete_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_provider_reference: providerReference || null,
      p_payout_provider: payoutProvider || null
    });

    if (error) return { error: error.message };

    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to complete withdrawal" };
  }
}

/** Admin: reject a withdrawal (requested or processing -> rejected), restores creator balance */
export async function adminRejectWithdrawal(withdrawalId: string, reason?: string) {
  try {
    const role = await getCurrentRole();
    if (role !== "admin") return { error: "Admin only" };

    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("admin_reject_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_reason: reason || null
    });

    if (error) return { error: error.message };

    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reject withdrawal" };
  }
}

/** Admin / platform revenue — gated by admin_users via getCurrentRole */
export async function getPlatformRevenueSummary(fromIso?: string, toIso?: string) {
  try {
    const role = await getCurrentRole();
    if (role !== "admin") {
      return { error: "Admin only" };
    }

    const { supabase } = await requireUser();

    const { data, error } = await supabase.rpc("platform_revenue_summary", {
      p_from: fromIso || null, p_to: toIso || null
    });
    if (error) throw new Error(error.message);
    return data as {
      grossCampaignVolumeCents: number; platformRevenueCents: number;
      creatorPayoutsCents: number; rewardExpenditureCents: number;
      refundsCents: number; netPlatformRevenueCents: number;
      depositsCents: number; transactionCount: number;
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Revenue summary failed" };
  }
}

export async function topUpCampaign(campaignId: string, amountCents: number, requestKey: string) {
  try {
    assertPositiveCents(amountCents);
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("top_up_campaign_budget", { p_campaign_id: campaignId, p_amount_cents: amountCents, p_key: requestKey });
    if (error) throw new Error(error.message);
    revalidatePath("/billing");
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Top-up failed" }; }
}
