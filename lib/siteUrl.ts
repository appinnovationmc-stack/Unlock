/** Canonical public origin: NEXT_PUBLIC_SITE_URL, else Vercel host. */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) {
    return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  }
  const vercel = (process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "").trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, "")}`;
  }
  return "";
}

export function publicCampaignUrl(campaignId: string): string {
  const origin = siteOrigin();
  return origin ? `${origin}/campaign/${campaignId}` : `/campaign/${campaignId}`;
}
