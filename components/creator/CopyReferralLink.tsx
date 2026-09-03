"use client";

import { useState } from "react";

export function CopyReferralLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url =
      href.startsWith("http") ? href : `${window.location.origin}${href}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy your referral link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-volt hover:underline"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
