import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaystackSignature(raw: string | Buffer, header: string | null, secrets: string[], now = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secrets.length) return false;
  const matches = (body: string | Buffer, signature: string) =>
    /^[a-f0-9]{128}$/.test(signature) && secrets.filter(Boolean).some(secret =>
      timingSafeEqual(createHmac("sha512", secret).update(body).digest(), Buffer.from(signature, "hex")));
  if (!header.includes("=")) return matches(raw, header);
  const fields = header.split(",").map(part => part.trim());
  const timestamps = fields.filter(part => part.startsWith("t="));
  if (timestamps.length !== 1 || !/^t=\d+$/.test(timestamps[0])) return false;
  const timestamp = timestamps[0].slice(2);
  if (!Number.isSafeInteger(Number(timestamp)) || Math.abs(now - Number(timestamp)) > 300) return false;
  const signed = Buffer.concat([Buffer.from(`${timestamp}.`), Buffer.isBuffer(raw) ? raw : Buffer.from(raw)]);
  return fields.filter(part => part.startsWith("v1=whk_")).some(part => matches(signed, part.slice(part.indexOf(":") + 1)));
}
