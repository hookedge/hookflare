import { describe, it, expect } from "vitest";
import { verifyWebhookSignature } from "../src/lib/crypto";

async function hmacSign(algorithm: string, secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return [...new Uint8Array(signed)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("HMAC-SHA256 verification (GitHub-style)", () => {
  it("verifies valid signature", async () => {
    const secret = "test-secret";
    const payload = '{"event":"test"}';
    const sig = await hmacSign("SHA-256", secret, payload);

    const result = await verifyWebhookSignature("hmac-sha256", secret, payload, sig);
    expect(result).toBe(true);
  });

  it("rejects invalid signature", async () => {
    const result = await verifyWebhookSignature(
      "hmac-sha256", "secret", "payload",
      "0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(result).toBe(false);
  });

  it("handles sha256= prefix (GitHub format)", async () => {
    const secret = "my-secret";
    const payload = "body";
    const sig = await hmacSign("SHA-256", secret, payload);

    const result = await verifyWebhookSignature("hmac-sha256", secret, payload, `sha256=${sig}`);
    expect(result).toBe(true);
  });
});

describe("Stripe signature verification", () => {
  it("verifies valid Stripe signature with timestamp", async () => {
    const secret = "whsec_test_secret";
    const payload = '{"id":"evt_123","type":"payment_intent.succeeded"}';
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const sig = await hmacSign("SHA-256", secret, signedPayload);

    const header = `t=${timestamp},v1=${sig}`;
    const result = await verifyWebhookSignature("stripe", secret, payload, header);
    expect(result).toBe(true);
  });

  it("rejects expired timestamp", async () => {
    const secret = "whsec_test_secret";
    const payload = "{}";
    const timestamp = Math.floor(Date.now() / 1000) - 600; // 10 min ago
    const signedPayload = `${timestamp}.${payload}`;
    const sig = await hmacSign("SHA-256", secret, signedPayload);

    const header = `t=${timestamp},v1=${sig}`;
    const result = await verifyWebhookSignature("stripe", secret, payload, header, { toleranceSec: 300 });
    expect(result).toBe(false);
  });

  it("rejects invalid signature with valid timestamp", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const header = `t=${timestamp},v1=0000000000000000000000000000000000000000000000000000000000000000`;
    const result = await verifyWebhookSignature("stripe", "secret", "payload", header);
    expect(result).toBe(false);
  });

  it("rejects missing timestamp", async () => {
    const result = await verifyWebhookSignature("stripe", "secret", "payload", "v1=abc123");
    expect(result).toBe(false);
  });

  it("rejects missing v1 signature", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await verifyWebhookSignature("stripe", "secret", "payload", `t=${timestamp}`);
    expect(result).toBe(false);
  });

  it("accepts when any v1 signature matches (multiple signatures)", async () => {
    const secret = "whsec_test_secret";
    const payload = "test";
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const validSig = await hmacSign("SHA-256", secret, signedPayload);
    const invalidSig = "0000000000000000000000000000000000000000000000000000000000000000";

    const header = `t=${timestamp},v1=${invalidSig},v1=${validSig}`;
    const result = await verifyWebhookSignature("stripe", secret, payload, header);
    expect(result).toBe(true);
  });
});
