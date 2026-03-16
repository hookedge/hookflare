/**
 * Webhook signature verification.
 *
 * Supports:
 * - Stripe: t=timestamp,v1=signature format, signed payload = "${t}.${body}"
 * - GitHub: sha256=hex or sha1=hex format
 * - Generic HMAC: raw hex signature
 */

export type VerificationType = "stripe" | "hmac-sha256" | "hmac-sha1";

/**
 * Verify a webhook signature based on the verification type.
 */
export async function verifyWebhookSignature(
  type: VerificationType,
  secret: string,
  payload: string,
  signatureHeader: string,
  opts?: { toleranceSec?: number },
): Promise<boolean> {
  switch (type) {
    case "stripe":
      return verifyStripeSignature(secret, payload, signatureHeader, opts?.toleranceSec ?? 300);
    case "hmac-sha256":
      return verifyHmacSignature("SHA-256", secret, payload, signatureHeader);
    case "hmac-sha1":
      return verifyHmacSignature("SHA-1", secret, payload, signatureHeader);
    default:
      return verifyHmacSignature("SHA-256", secret, payload, signatureHeader);
  }
}

/**
 * Stripe signature verification.
 *
 * Header format: t=1492774577,v1=5257a869...,v1=...
 * Signed payload: "${timestamp}.${body}"
 * Algorithm: HMAC-SHA256
 */
async function verifyStripeSignature(
  secret: string,
  payload: string,
  header: string,
  toleranceSec: number,
): Promise<boolean> {
  const parts = header.split(",");

  // Extract timestamp
  const tPart = parts.find((p) => p.startsWith("t="));
  if (!tPart) return false;
  const timestamp = parseInt(tPart.slice(2), 10);
  if (isNaN(timestamp)) return false;

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) return false;

  // Extract v1 signatures
  const signatures = parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (signatures.length === 0) return false;

  // Compute expected signature: HMAC-SHA256("${timestamp}.${payload}")
  const signedPayload = `${timestamp}.${payload}`;
  const expected = await computeHmac("SHA-256", secret, signedPayload);

  // Match against any v1 signature (Stripe may include multiple)
  return signatures.some((sig) => timingSafeEqual(expected, sig));
}

/**
 * Generic HMAC signature verification.
 * Handles prefixed signatures like "sha256=hex" or "sha1=hex".
 */
async function verifyHmacSignature(
  algorithm: string,
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const expected = await computeHmac(algorithm, secret, payload);

  // Strip common prefixes: "sha256=", "sha1=", "v1="
  const rawSignature = signature.replace(/^(sha256|sha1|v1)=/, "");

  return timingSafeEqual(expected, rawSignature);
}

async function computeHmac(algorithm: string, secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return hexEncode(signed);
}

function hexEncode(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
