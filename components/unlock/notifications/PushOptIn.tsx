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
 * Purpose-stated opt-in for push notifications (reward unlocks, nearby
 * drops). Mirrors the existing location-permission pattern: explain why,
 * then ask — never a blind browser prompt on load.
 *
 * Inert until NEXT_PUBLIC_VAPID_PUBLIC_KEY is set — renders nothing without it,
 * since there is no working push pipeline to subscribe into yet.
 */
export function PushOptIn() {
  const [status, setStatus] = useState<Status>("idle");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!vapidKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => setStatus("error"));
  }, [vapidKey]);

  if (!vapidKey || status === "unsupported") return null;

  async function enable() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey as string)
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON())
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("subscribed");
    } catch {
      setStatus("error");
    }
  }

  if (status === "subscribed") return null;

  return (
    <div className="border border-white/8 bg-ink2/80 px-4 py-3 flex items-center justify-between gap-4">
      <p className="font-mono text-[11px] text-mute leading-relaxed">
        Get notified the moment a reward unlocks or a new experience drops near you.
      </p>
      <button
        type="button"
        onClick={enable}
        className="font-mono text-[10px] uppercase tracking-widest text-volt border border-volt/40 px-3 py-1.5 hover:bg-volt/10 shrink-0"
      >
        Enable
      </button>
    </div>
  );
}
