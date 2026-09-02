"use client";

import { useState, useTransition } from "react";
import { recordInteraction } from "@/lib/unlock/interactions/record";

export function QrScan({ campaignId }: { campaignId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const canDetect =
    typeof window !== "undefined" && "BarcodeDetector" in window && typeof createImageBitmap === "function";

  async function onPick(file: File | undefined) {
    setMsg(null);
    if (!file) return;
    if (!canDetect) {
      setMsg("This browser cannot read a QR from the camera. No scan was recorded.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      // @ts-expect-error BarcodeDetector
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const codes = (await detector.detect(bitmap)) as { rawValue?: string }[];
      const raw = String(codes?.[0]?.rawValue ?? "").trim();
      if (!raw) {
        setMsg("No QR in that frame. Try again.");
        return;
      }
      start(async () => {
        const result = await recordInteraction({
          eventType: "QR_SCAN",
          campaignId,
          verificationMethod: "qr",
          metadata: { raw, source: "camera_qr" },
          idempotencyKey: `qr:${campaignId}:${raw.slice(0, 80)}`
        });
        if (result.error) {
          setMsg(result.error);
          return;
        }
        setOk(true);
        setMsg("QR read. Scan is pending — not a visit or unlock.");
      });
    } catch {
      setMsg("Could not read QR.");
    }
  }

  return (
    <div className="border border-white/10 bg-ink2/60 p-5 space-y-3">
      <p className="text-xs text-volt">Scan</p>
      <p className="text-mute text-xs">
        Point the camera at the campaign QR. A photo with no code is not a scan.
      </p>
      <label
        className={`block w-full text-center text-sm py-3 border rounded-full cursor-pointer ${
          ok ? "border-gold text-gold" : "border-white/25 text-fog hover:border-volt/60"
        } ${pending || ok ? "opacity-50 pointer-events-none" : ""}`}
      >
        {ok ? "QR read" : pending ? "Reading…" : "Choose a frame"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={pending || ok}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPick(file);
          }}
        />
      </label>
      {msg && <p className="text-xs text-center text-mute">{msg}</p>}
    </div>
  );
}
