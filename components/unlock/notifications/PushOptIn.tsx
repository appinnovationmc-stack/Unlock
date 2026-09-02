"use client";

import { useEffect, useState } from "react";

// Converts a base64url VAPID public key to the Uint8Array PushManager expects.
function urlBase64ToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status = "idle" | "unsupported" | "denied" | "subscribed" | "error";

/**
 * Purpose-stated opt-in for push. Hidden unless the server has a full VAPID
 * keypair (public + private). No toasts. Subscribe never looks successful
 * when the send pipeline is not configured.
 */
export function PushOptIn() {
  const [ready, setReady] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/push/status");
      const data = (await res.json().catch(() => null)) as
        | { ready?: boolean; publicKey?: string | null }
        | null;
      if (cancelled) return;
      if (!data?.ready || !data.publicKey) {
        setReady(false);
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus("unsupported");
        return;
      }
      setPublicKey(data.publicKey);
      setReady(true);
      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      if (sub) setStatus("subscribed");
    })().catch(() => {
      if (!cancelled) setReady(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || status === "unsupported") return null;

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON())
      });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => undefined);
        throw new Error("subscribe failed");
      }
      setStatus("subscribed");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  if (status === "denied") {
    return (
      <p className="font-mono text-[11px] text-mute">
        Notifications are blocked in this browser. Enable them in site settings if you want unlock alerts.
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="font-mono text-[11px] text-mute">
        Could not subscribe for notifications. Push is not active.
      </p>
    );
  }

  if (status === "subscribed") {
    return (
      <div className="border border-white/8 bg-ink2/80 px-4 py-3 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] text-mute leading-relaxed">
          This browser is subscribed. Pushes are not sent yet — the server has no Web Push sender.
        </p>
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="font-mono text-[10px] uppercase tracking-widest text-mute border border-white/20 px-3 py-1.5 hover:bg-white/5 shrink-0 disabled:opacity-50"
        >
          Disable
        </button>
      </div>
    );
  }

  return (
    <div className="border border-white/8 bg-ink2/80 px-4 py-3 flex items-center justify-between gap-4">
      <p className="font-mono text-[11px] text-mute leading-relaxed">
        Get notified the moment a reward unlocks or a new experience drops near you.
      </p>
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/40 px-3 py-1.5 hover:bg-volt/10 shrink-0 disabled:opacity-50"
      >
        Enable
      </button>
    </div>
  );
}
