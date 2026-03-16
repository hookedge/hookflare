import type { Context } from "hono";
import type { Env, QueueMessage } from "../lib/types";
import { generateId } from "../lib/id";
import { createDb, getSource, createEvent } from "../db/queries";
import { verifyWebhookSignature } from "../lib/crypto";
import type { VerificationType } from "../lib/crypto";
import { ApiError } from "../lib/errors";

/**
 * POST /webhooks/:source_id
 *
 * 1. Look up source in D1
 * 2. Verify signature (if configured)
 * 3. Check idempotency (KV)
 * 4. Archive payload (R2)
 * 5. Record event (D1)
 * 6. Enqueue for delivery (Queue)
 * 7. Return 202 Accepted
 */
export async function handleWebhookIngress(c: Context<{ Bindings: Env }>) {
  const sourceId = c.req.param("source_id")!;
  const env = c.env;
  const db = createDb(env.DB);

  // 1. Look up source
  const source = await getSource(db, sourceId);
  if (!source) {
    throw new ApiError(404, `Source not found: ${sourceId}`, "SOURCE_NOT_FOUND");
  }

  // Read raw body
  const body = await c.req.text();

  // 2. Verify signature if configured
  if (source.verification_type && source.verification_secret) {
    const signatureHeader = resolveSignatureHeader(
      source.verification_type,
      c.req.header.bind(c.req),
    );

    if (!signatureHeader) {
      throw new ApiError(401, "Missing webhook signature", "MISSING_SIGNATURE");
    }

    const valid = await verifyWebhookSignature(
      source.verification_type as VerificationType,
      source.verification_secret,
      body,
      signatureHeader,
    );

    if (!valid) {
      throw new ApiError(401, "Invalid webhook signature", "INVALID_SIGNATURE");
    }
  }

  // 3. Check idempotency
  const idempotencyKey =
    c.req.header("x-idempotency-key") ??
    c.req.header("x-request-id") ??
    c.req.header("x-webhook-id");

  if (idempotencyKey) {
    const kvKey = `idem:${sourceId}:${idempotencyKey}`;
    const existing = await env.IDEMPOTENCY_KV.get(kvKey);
    if (existing) {
      return c.json({ message: "Duplicate event ignored", event_id: existing }, 200);
    }
  }

  // Parse event type from body (best effort)
  let eventType: string | null = null;
  try {
    const parsed = JSON.parse(body);
    eventType = parsed.type ?? parsed.event ?? parsed.event_type ?? null;
    if (typeof eventType !== "string") eventType = null;
  } catch {
    // Not JSON — that's fine, we still accept it
  }

  // 4. Archive payload to R2
  const eventId = generateId("evt");
  const r2Key = `${sourceId}/${eventId}`;
  await env.PAYLOAD_BUCKET.put(r2Key, body, {
    httpMetadata: { contentType: c.req.header("content-type") ?? "application/octet-stream" },
  });

  // Capture relevant headers
  const headers: Record<string, string> = {};
  for (const key of ["content-type", "user-agent", "x-request-id", "x-webhook-id"]) {
    const val = c.req.header(key);
    if (val) headers[key] = val;
  }

  // 5. Record event in D1
  await createEvent(db, {
    id: eventId,
    source_id: sourceId,
    event_type: eventType,
    idempotency_key: idempotencyKey ?? null,
    payload_r2_key: r2Key,
    headers: JSON.stringify(headers),
  });

  // 6. Store idempotency key
  if (idempotencyKey) {
    const ttl = parseInt(env.IDEMPOTENCY_TTL_S, 10) || 86400;
    await env.IDEMPOTENCY_KV.put(`idem:${sourceId}:${idempotencyKey}`, eventId, {
      expirationTtl: ttl,
    });
  }

  // 7. Enqueue for delivery
  const queueMessage: QueueMessage = {
    eventId,
    sourceId,
    eventType,
    payloadR2Key: r2Key,
    headers,
    receivedAt: new Date().toISOString(),
  };

  await env.WEBHOOK_QUEUE.send(queueMessage);

  return c.json({ message: "Accepted", event_id: eventId }, 202);
}

/**
 * Resolve the correct signature header based on verification type.
 * Each provider uses a different header name.
 */
function resolveSignatureHeader(
  type: string,
  getHeader: (name: string) => string | undefined,
): string | null {
  switch (type) {
    case "stripe":
      return getHeader("stripe-signature") ?? null;
    case "hmac-sha256":
      return getHeader("x-hub-signature-256") ?? getHeader("x-webhook-signature") ?? null;
    case "hmac-sha1":
      return getHeader("x-hub-signature") ?? null;
    default:
      return getHeader("x-webhook-signature") ?? getHeader("x-hub-signature-256") ?? null;
  }
}
