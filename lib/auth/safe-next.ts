/** Same-origin return path only. Must start with `/`, not `//` or a protocol. */
export function safeNextPath(
  value: string | null | undefined,
  fallback = "/discover"
): string {
  if (!value) return fallback;
  const next = value.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}

export function campaignLoginHref(campaignId: string): string {
  return `/login?next=/campaign/${campaignId}`;
}
