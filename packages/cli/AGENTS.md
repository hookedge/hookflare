# hookflare CLI — Agent Guide

This file contains instructions for AI agents operating the hookflare CLI.

## Authentication

Before any API call, configure the connection:

```bash
hookflare config set api_url http://localhost:8787
hookflare config set token hf_sk_your_api_key
```

Or pass inline: every command respects the configured `api_url` and `token`.

## Rules

- Always use `--json` flag for machine-readable output
- Always use `--dry-run` before mutations (create, delete) to validate first
- Always use `--data` (raw JSON) for create commands instead of individual flags
- Always use `--fields` on list commands to limit output to needed columns
- Never delete resources without confirming with the user first
- Never pass secrets in resource names or IDs

## Common Workflows

### Create a complete webhook pipeline

```bash
# 1. Create source
hookflare sources create --json -d '{"name":"stripe","verification":{"type":"hmac-sha256","secret":"whsec_..."}}'

# 2. Create destination
hookflare dest create --json -d '{"name":"my-api","url":"https://api.example.com/hooks","retry_policy":{"max_retries":3}}'

# 3. Create subscription (use IDs from steps 1 and 2)
hookflare subs create --json -d '{"source_id":"src_xxx","destination_id":"dst_yyy","event_types":["payment.*"]}'
```

### Backup and restore

```bash
hookflare export --json -o backup.json
hookflare import -f backup.json
```

### Migrate between instances

```bash
hookflare migrate --from http://old:8787 --from-key hf_sk_old --to http://new:8787 --to-key hf_sk_new
```

### Check system status

```bash
hookflare health --json
hookflare sources ls --json --fields id,name
hookflare events ls --json --limit 5
```

## Error Handling

All errors return structured JSON when `--json` is used:

```json
{"success": false, "error": "error message"}
```

Non-zero exit codes indicate failure. Parse stderr for error details.

## Resource ID Format

- Sources: `src_<hex>`
- Destinations: `dst_<hex>`
- Subscriptions: `sub_<hex>`
- Events: `evt_<hex>`
- Deliveries: `dlv_<hex>`
- API Keys: `key_<hex>`
