import { NextResponse } from "next/server";
import { getMyOrgId } from "@/lib/actions/campaigns";
import { getOrgCampaignAnalytics } from "@/lib/actions/finance";
import { planDropFromAudience } from "@/lib/unlock/studio/plan-drop";

export const dynamic = "force-dynamic";

export async function GET() {
  const orgId = await getMyOrgId();
  if (!orgId) return NextResponse.json({ error: "no_org" }, { status: 401 });

  const analyticsResult = await getOrgCampaignAnalytics(orgId);
  const rows =
    "analytics" in analyticsResult && analyticsResult.analytics ? analyticsResult.analytics : [];
  const walkers = rows.reduce((n: number, a: { unique_consumers?: number }) => n + (a.unique_consumers ?? 0), 0);
  const unlocks = rows.reduce((n: number, a: { unlocks?: number }) => n + (a.unlocks ?? 0), 0);
  const visits = rows.reduce(
    (n: number, a: { verified_visits?: number }) => n + (a.verified_visits ?? 0),
    0
  );

  return NextResponse.json(planDropFromAudience({ walkers, unlocks, visits }));
}
