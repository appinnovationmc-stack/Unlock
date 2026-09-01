"use client";

import { useEffect, useMemo, useState } from "react";

function resolveShareUrl(campaignId: string, shareUrl?: string) {
  if (shareUrl && /^https?:\/\//i.test(shareUrl)) return shareUrl;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/campaign/${campaignId}`;
}

/**
 * WhatsApp-first broadcast — pass a live encounter in one tap. No login.
 */
export function ShareMoment({
  campaignId,
  title,
  shareUrl
}: {
  campaignId: string;
  title: string;
  shareUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const url = useMemo(
    () => resolveShareUrl(campaignId, shareUrl),
    [campaignId, shareUrl]
  );

  const message = `${title}\n${url}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  async function nativeShare() {
    try {
      await navigator.share({ title, text: title, url });
    } catch {
      /* user cancelled */
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-10 border border-volt/25 bg-void clip-keyhole px-4 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-volt mb-2">
        Broadcast
      </p>
      <h2 className="font-display text-xl text-fog uppercase tracking-wide mb-2">
        Share this encounter
      </h2>
      <p className="text-mute text-sm mb-5 leading-relaxed">
        Pass it on in one tap. WhatsApp first — no login.
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 font-display text-sm uppercase tracking-wide clip-keyhole-sm bg-volt text-void hover:bg-fog transition-colors duration-150"
        >
          WhatsApp
        </a>
        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-display text-sm uppercase tracking-wide clip-keyhole-sm bg-transparent text-fog border border-mute/40 hover:border-volt hover:text-volt transition-colors duration-150"
          >
            Share
          </button>
        )}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 font-display text-sm uppercase tracking-wide clip-keyhole-sm bg-transparent text-fog border border-mute/40 hover:border-volt hover:text-volt transition-colors duration-150"
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
