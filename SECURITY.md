# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in hookflare, **please do not open a public issue.**

Report it privately via [GitHub Security Advisories](https://github.com/hookedge/hookflare/security/advisories/new).

We will acknowledge your report within 48 hours and provide a fix timeline.

## Supported Versions

| Version | Supported |
|---|---|
| v0.1.x-alpha | ✅ Security fixes |
| < v0.1.0 | ❌ |

## Security Design

### Webhook Signature Verification

- **Stripe**: Validates `Stripe-Signature` header — HMAC-SHA256 with timestamp tolerance, prevents replay attacks. Supports multiple `v1` signatures for key rotation.
- **GitHub**: Validates `X-Hub-Signature-256` header — HMAC-SHA256.
- **Generic HMAC**: Configurable header and algorithm.
- All comparisons use **timing-safe comparison** to prevent timing attacks.

### Secrets Handling

- **Verification secrets** (e.g., Stripe `whsec_...`) are stored in D1. GET API responses return **masked values** (`****xxxx`, last 4 characters only). The full secret is returned only once at creation time. Export includes full secrets for migration.
- **API keys** are stored as **SHA-256 hashes**. The raw key (`hf_sk_...`) is returned only once at creation time and cannot be retrieved afterward.

### Data Storage

All Cloudflare services provide encryption at rest:

- **D1**: Configuration, delivery logs, API key hashes
- **KV**: Idempotency keys (ephemeral, TTL-based)
- **R2**: Webhook payload archive (configurable retention)
- **Durable Object Storage**: Retry state and circuit breaker state

### Network

- Cloudflare Workers enforce HTTPS/TLS on all inbound traffic.
- Outbound delivery requests use the destination URL as configured (HTTPS recommended).

## Known Limitations

### Auth bootstrap mode

When no `API_TOKEN` environment variable is set and no API keys exist in D1, the management API allows unauthenticated access to the key creation endpoint for first-run setup.

**Mitigation**: Set `API_TOKEN` via `wrangler secret put API_TOKEN` immediately after deployment.

### No destination URL validation

Destination URLs accept any value. No SSRF protection against internal IPs or non-HTTPS URLs.

**Mitigation**: Only grant API keys to trusted users. URL validation is planned.

### Rate limiter eventual consistency

The KV-based rate limiter uses a non-atomic read-then-write pattern. Under high concurrent load, the actual request count may briefly exceed the configured limit.

**Mitigation**: Use Cloudflare WAF rules for strict rate limiting. The built-in limiter is best-effort.

### No payload size enforcement

The ingress handler does not enforce a maximum request body size.

**Mitigation**: Configure body size limits via Cloudflare WAF or Workers settings.
