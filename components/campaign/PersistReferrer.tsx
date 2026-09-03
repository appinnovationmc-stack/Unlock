"use client";

import { useEffect } from "react";

const key = (campaignId: string) => `unlock_ref_${campaignId}`;

export function readStoredReferrer(campaignId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key(campaignId));
  } catch {
    return null;
  }
}

/** Keep ?ref= across in-app hops so unlock still attributes the creator. */
export function PersistReferrer({
  campaignId,
  referrerCreatorId
}: {
  campaignId: string;
  referrerCreatorId?: string | null;
}) {
  useEffect(() => {
    if (!referrerCreatorId) return;
    try {
      sessionStorage.setItem(key(campaignId), referrerCreatorId);
    } catch {
      /* private mode */
    }
  }, [campaignId, referrerCreatorId]);
  return null;
}
