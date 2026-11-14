"use client";
import { useState, useTransition } from "react";
import { merchantRedeem } from "@/lib/actions/rewards";
export default function MerchantRedemptionPage() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <main className="max-w-xl mx-auto p-8"><h1 className="text-2xl mb-4">Confirm reward fulfilment</h1>
    <p className="mb-4">Check the customer’s reward and provide it before confirming. Only members of the campaign’s brand can redeem its tokens.</p>
    <form action={data => startTransition(async () => { const result = await merchantRedeem(data); setMessage(result.error || "Reward fulfilment recorded."); })}>
      <label htmlFor="token">Customer token</label><input id="token" name="token" required minLength={32} maxLength={32} className="block w-full p-3 bg-black border border-white/30 my-3" />
      <button disabled={pending} className="border px-4 py-2">{pending ? "Confirming…" : "Confirm fulfilled"}</button>
    </form><p role="status" className="mt-4">{message}</p>
  </main>;
}
