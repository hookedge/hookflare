# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

hookflare is an open-source webhook infrastructure service built entirely on the Cloudflare Workers ecosystem. It receives incoming webhooks, queues them durably, and reliably delivers them to configured destinations with retry logic. GitHub org: `hookedge`.

## Monorepo Structure (pnpm + Turborepo)

```
hookflare/
├── packages/
│   ├── worker/        # Cloudflare Worker — webhook engine (Hono + D1 + Drizzle)
│   ├── shared/        # Shared TypeScript types (API entities, export format)
│   └── cli/           # CLI tool (npm: hookflare) — agent-optimized
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Tech Stack

- **Runtime**: Cloudflare Workers (TypeScript)
- **Framework**: Hono (lightweight edge-native router)
- **ORM**: Drizzle ORM (type-safe, zero overhead)
- **Database**: Cloudflare D1 (SQLite)
- **Queue**: Cloudflare Queues (durable message buffer)
- **Cache**: Cloudflare KV (idempotency keys)
- **State**: Cloudflare Durable Objects (per-destination retry state machines)
- **Storage**: Cloudflare R2 (webhook payload archive)
- **CLI**: Commander + tsup (published as `hookflare` on npm)

## Commands

```bash
pnpm install                                    # Install all dependencies
pnpm --filter @hookflare/shared build           # Build shared types (do this first)
pnpm --filter @hookflare/worker dev             # Start local dev server (wrangler dev)
pnpm --filter @hookflare/worker test            # Run tests (vitest + Workers runtime)
pnpm --filter @hookflare/worker typecheck       # TypeScript type checking
pnpm --filter @hookflare/worker db:migrate:local # Run D1 migrations locally
pnpm --filter hookflare build                   # Build CLI
pnpm --filter hookflare typecheck               # Typecheck CLI
```

## Architecture

### Core Flow

1. **Ingress Worker** receives webhook POST at `/webhooks/:source_id`, verifies signature, checks idempotency (KV), returns `202 Accepted`, enqueues to Cloudflare Queue.
2. **Queue Consumer** reads messages, looks up subscriptions in D1, dispatches to the Durable Object for each destination.
3. **Delivery Manager (Durable Object)** — one instance per destination — performs the outbound `fetch()`, manages exponential backoff retries via the alarm API, and logs delivery attempts to D1.

### Authentication

- `/webhooks/*` and `/health` — public (no auth)
- `/api/v1/*` — requires Bearer token
- Simple mode: `API_TOKEN` env var
- Advanced mode: D1-managed API keys (`hf_sk_*` prefix)

### Data Model (Drizzle schema at `packages/worker/src/db/schema.ts`)

- **Source** — webhook sender (e.g., "stripe"), with optional signature verification
- **Destination** — target URL with retry policy
- **Subscription** — connects source → destination, with event type filters
- **Event** — received webhook payload with metadata
- **Delivery** — delivery attempt log (status, latency, response)
- **ApiKey** — API key for management API access

### API Routes

- `POST /webhooks/:source_id` — Webhook ingestion (public)
- `/api/v1/sources|destinations|subscriptions|events|keys` — REST management API (authenticated)
- `GET /api/v1/export` — Export all configuration
- `POST /api/v1/import` — Import configuration

### CLI (packages/cli/)

Agent-optimized CLI with:
- `--json` for structured output
- `-d/--data` for raw JSON input
- `--dry-run` for safe mutation validation
- `--fields` for output field selection
- `hookflare schema` for runtime API introspection
- `hookflare export/import/migrate` for instance migration
- See `packages/cli/AGENTS.md` for agent-specific guidance

## Code Conventions

- All code, comments, and documentation in US English (en-US).
- Configuration via `wrangler.jsonc` environment variables and D1 database.
- Drizzle ORM for all database operations (schema in `src/db/schema.ts`).
- Atomic commits — each commit should be a single logical change.
