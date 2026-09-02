/** True only when a VAPID keypair exists. Public-only is not enough to send. */
export function vapidPublicKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  return key && key.trim().length > 20 ? key.trim() : undefined;
}

export function vapidPrivateKey(): string | undefined {
  const key = process.env.VAPID_PRIVATE_KEY;
  return key && key.trim().length > 20 ? key.trim() : undefined;
}

export function isPushSendReady(): boolean {
  return Boolean(vapidPublicKey() && vapidPrivateKey());
}
