/** Decode HTML entities that were stored or hardcoded as text (not JSX). */
export function unescapeHtmlEntities(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .trim();
}
