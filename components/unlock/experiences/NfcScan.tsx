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
      setMsg("NFC is only available on supported Android Chrome devices. Use QR or product code instead.");
      return;
    }
    start(async () => {
      try {
        // @ts-expect-error Web NFC API
        const reader = new NDEFReader();
        await reader.scan();
        setMsg("Ready — hold near an NFC tag…");
        reader.onreading = async (event: { serialNumber?: string }) => {
          const serial = event.serialNumber ?? "tag";
          const result = await recordInteraction({
            eventType: "NFC_SCAN",
            campaignId,
            verificationMethod: "nfc",
            metadata: { serial, source: "web_nfc" },
            idempotencyKey: `nfc:${campaignId}:${serial}`
          });
          if (result.error) { setMsg(result.error); return; }
          setOk(true);
          setMsg("NFC tag read. Interaction recorded.");
        };
      } catch (e: unknown) {
        setMsg((e as { message?: string })?.message ?? "NFC scan failed or permission denied.");
      }
    });
  }

  return (
    <div className="border border-white/10 bg-ink2/60 p-5 space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-volt">NFC</p>
      <p className="text-mute text-xs">Physical tag verification where Web NFC is available.</p>
      <button type="button" onClick={scan} disabled={pending || ok}
        className={`w-full font-mono text-[10px] uppercase tracking-widest py-3 border focus-visible:outline focus-visible:outline-2 focus-visible:outline-volt ${ok ? "border-gold text-gold" : "border-volt text-volt hover:bg-volt/10"} disabled:opacity-50`}>
        {ok ? "Scanned" : pending ? "Scanning…" : "Scan NFC tag"}
      </button>
      {msg && <p className="text-xs text-center text-mute">{msg}</p>}
    </div>
  );
}
