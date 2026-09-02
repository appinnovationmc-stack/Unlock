"use client";

import { useState, useTransition } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

export function NfcScan({ campaignId }: { campaignId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const supported = typeof window !== "undefined" && "NDEFReader" in window;

  function scan() {
    setMsg(null);
    if (!supported) {
      setMsg("NFC works on Android Chrome only. iPhone cannot scan tags in the browser. Use QR instead.");
      return;
    }
    start(async () => {
      try {
        // @ts-expect-error Web NFC API
        const reader = new NDEFReader();
        await reader.scan();
        setMsg("Hold the phone near the tag.");
        reader.onreading = async (event: { serialNumber?: string }) => {
          const serial = event.serialNumber ?? "";
          if (!serial) {
            setMsg("Tag was empty. Try again.");
            return;
          }
          const result = await recordInteraction({
            eventType: "NFC_SCAN",
            campaignId,
            verificationMethod: "nfc",
            metadata: { serial, source: "web_nfc" },
            idempotencyKey: `nfc:${campaignId}:${serial}`
          });
          if (result.error) {
            setMsg(result.error);
            return;
          }
          setOk(true);
          setMsg("Tag read. Scan is pending — not a visit or unlock.");
        };
      } catch (e: unknown) {
        setOk(false);
        setMsg((e as { message?: string })?.message ?? "NFC scan failed or permission denied.");
      }
    });
  }

  return (
    <div className="border border-white/10 bg-ink2/60 p-5 space-y-3">
      <p className="text-xs text-volt">Tap</p>
      <p className="text-mute text-xs">
        NFC works on Android Chrome only. iPhone cannot scan tags here. Use QR if you are on iOS.
      </p>
      <button
        type="button"
        onClick={scan}
        disabled={pending || ok || !supported}
        className={`w-full text-sm py-3 border rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt ${
          ok ? "border-gold text-gold" : "border-white/25 text-fog hover:border-volt/60"
        } disabled:opacity-50`}
      >
        {ok ? "Tag read" : pending ? "Listening…" : supported ? "Hold near tag" : "Not available on this phone"}
      </button>
      {msg && <p className="text-xs text-center text-mute">{msg}</p>}
    </div>
  );
}
