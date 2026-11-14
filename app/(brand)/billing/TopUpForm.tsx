"use client";
import { useState, useTransition } from "react";
import { topUpCampaign } from "@/lib/actions/finance";
export function TopUpForm({ campaignId }: { campaignId: string }) {
 const [key,setKey]=useState<string | null>(null);
 const [message,setMessage]=useState("");
 const [pending,start]=useTransition();
 return <form className="mt-3 flex gap-2 flex-wrap" action={form=>start(async()=>{
   const requestKey=key || crypto.randomUUID(); setKey(requestKey);
   const result=await topUpCampaign(campaignId,Math.round(Number(form.get("amount"))*100),requestKey);
   setMessage(result.error || "Performance budget topped up.");
   if(!result.error)setKey(null);
 })}><label>Performance top-up (ZAR)<input name="amount" type="number" min="1" step="0.01" required disabled={pending} className="block bg-black border p-2 w-36" /></label><button disabled={pending} className="border p-2">Top up</button><p className="w-full text-xs">The campaign platform fee applies; the remainder increases its performance allocation.</p><p role="status">{message}</p></form>;
}
