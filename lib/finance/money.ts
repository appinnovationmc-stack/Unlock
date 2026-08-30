/**
 * Safe monetary helpers.
 * All amounts are integer minor units (cents). Never use floating point for money.
 */

export type CurrencyCode = "ZAR" | "USD" | "EUR" | "GBP";

export function formatMoney(cents: number, currency: CurrencyCode | string = "ZAR"): string {
  const abs = Math.abs(cents);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const sign = cents < 0 ? "-" : "";
  const symbol =
    currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  return `${sign}${symbol}${major.toLocaleString("en-ZA")}.${minor.toString().padStart(2, "0")}`;
}

export function toCents(major: number): number {
  // Avoid float: multiply then round to nearest cent
  return Math.round(major * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Basis points: 1500 = 15.00% */
export function applyBps(amountCents: number, bps: number): number {
  return Math.floor((amountCents * bps) / 10000);
}

export function assertPositiveCents(cents: number, label = "amount"): void {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error(`${label} must be a positive integer (cents)`);
  }
}

export function assertNonNegativeCents(cents: number, label = "amount"): void {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`${label} must be a non-negative integer (cents)`);
  }
}
