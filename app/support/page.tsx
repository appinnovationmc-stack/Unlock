"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { submitSupportRequest } from "@/lib/actions/support";
export default function SupportPage() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <main className="max-w-2xl mx-auto p-8"><h1 className="text-3xl mb-4">Support and privacy requests</h1>
    <p className="mb-5">Sign in to request help, a refund review, access to your information, or account deletion. Your request is recorded for the platform operator. Do not include passwords, full bank details, or card numbers.</p>
    <form action={form => startTransition(async () => { const result = await submitSupportRequest(form); setMessage(result.error || `Request saved. Reference: ${result.id}`); })} className="space-y-4">
      <label className="block">Request type<select name="category" className="block bg-black border p-2"><option value="support">Support</option><option value="refund">Refund review</option><option value="privacy">Privacy / data access</option><option value="deletion">Account deletion</option></select></label>
      <label className="block">Details<textarea name="message" required minLength={10} maxLength={4000} rows={6} className="block w-full bg-black border p-3" /></label>
      <button disabled={pending} className="border px-4 py-2">{pending ? "Saving…" : "Submit request"}</button>
    </form><p role="status" className="my-4">{message}</p><Link href="/login">Sign in</Link>
  </main>;
}
