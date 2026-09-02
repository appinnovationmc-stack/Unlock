"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { claimProductCode, confirmProductClaim } from "@/lib/actions/product-hunt";
import { recordInteraction } from "@/lib/unlock/interactions/record";
import { Button } from "@/components/ui/Button";

type Stage = "find" | "pending" | "confirmed";

export function ProductHuntClaim({
  campaignId,
  initialCode
}: {
  campaignId: string;
  initialCode?: string | null;
}) {
  const [code, setCode] = useState(initialCode ?? "");
  const [storeLocation, setStoreLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("find");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [rewardLabel, setRewardLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmitFind() {
    setError(null);

    if (!code.trim()) {
      setError("Scan or enter the code on the product first.");
      return;
    }

    let proofPhotoUrl: string | null = null;

    if (file) {
      setUploading(true);
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setUploading(false);
        setError("You need to log in to claim this.");
        return;
      }

      const path = `${user.id}/${campaignId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("proof-photos")
        .upload(path, file, { upsert: false });

      setUploading(false);

      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        return;
      }

      const { data: publicUrl } = supabase.storage.from("proof-photos").getPublicUrl(path);
      proofPhotoUrl = publicUrl.publicUrl;
    }

    startTransition(async () => {
      const result = await claimProductCode(
        campaignId,
        code,
        proofPhotoUrl,
        storeLocation.trim() || null
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setClaimId(result.claimId);
      setRewardLabel(result.rewardLabel);
      setStage("pending");
      void recordInteraction({
        eventType: "PRODUCT_INTERACTION",
        campaignId,
        verificationMethod: "product",
        metadata: { code: code.trim(), store: storeLocation.trim() || null, source: "product_hunt" },
        idempotencyKey: `product:${campaignId}:${code.trim().toUpperCase()}`
      });
    });
  }

  function handleShareAndConfirm() {
    if (!claimId) return;
    setError(null);

    startTransition(async () => {
      const result = await confirmProductClaim(claimId, campaignId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.confirmed) {
        setStage("confirmed");
      }
    });
  }

  if (stage === "confirmed") {
    return (
      <div className="mt-4 text-center space-y-3">
        <p className="font-display text-gold text-lg">Claim confirmed</p>
        {rewardLabel && <p className="text-sm text-fog">Reward: {rewardLabel}</p>}
        <Link href="/wallet">
          <Button variant="ghost" className="border-gold/50 text-gold">
            Open wallet
          </Button>
        </Link>
      </div>
    );
  }

  if (stage === "pending") {
    return (
      <div className="mt-4 space-y-4">
        <div className="border border-white/15 px-4 py-3 text-center">
          <p className="section-kicker mb-1">Found it — pending verification</p>
          {rewardLabel && <p className="text-sm text-fog">{rewardLabel}</p>}
        </div>
        <p className="text-sm text-mute text-center">Share your find to unlock the reward.</p>
        <Button
          type="button"
          onClick={handleShareAndConfirm}
          disabled={isPending}
          variant="volt"
          className="w-full"
        >
          {isPending ? "Confirming…" : "I shared it — confirm claim"}
        </Button>
        {error && <p className="text-center text-sm text-magenta">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="text-sm text-mute block mb-1">Code on the product</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. MRPRIZE-7F3K9Q"
          className="w-full bg-ink2 border border-white/10 px-3 py-2 text-base text-fog focus:border-volt outline-none"
        />
      </div>

      <div>
        <label className="text-sm text-mute block mb-1">Proof photo (optional but recommended)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-mute file:mr-3 file:text-sm file:bg-ink2 file:border file:border-white/10 file:px-3 file:py-1.5 file:text-fog"
        />
      </div>

      <div>
        <label className="text-sm text-mute block mb-1">Where'd you find it?</label>
        <input
          type="text"
          value={storeLocation}
          onChange={(e) => setStoreLocation(e.target.value)}
          placeholder="e.g. Sandton City"
          className="w-full bg-ink2 border border-white/10 px-3 py-2 text-base text-fog focus:border-volt outline-none"
        />
      </div>

      <Button
        type="button"
        onClick={handleSubmitFind}
        disabled={isPending || uploading}
        variant="volt"
        className="w-full"
      >
        {uploading ? "Uploading photo…" : isPending ? "Claiming…" : "Claim this find"}
      </Button>

      {error && <p className="text-center text-sm text-magenta">{error}</p>}
    </div>
  );
}
