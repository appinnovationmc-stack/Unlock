/** Audience notifications are not enabled until brand-specific consent and delivery limits are implemented. */
export async function notifyBrandWalkers(_opts: { orgId: string; campaignId: string; title: string }): Promise<{ sent: number; reason: string }> {
  return { sent: 0, reason: "audience_notifications_not_enabled" };
}
