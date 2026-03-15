// API entity types — shared between worker and CLI
// These match the D1/Drizzle schema but are framework-agnostic

export interface Source {
  id: string;
  name: string;
  verification_type: string | null;
  verification_secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface Destination {
  id: string;
  name: string;
  url: string;
  timeout_ms: number;
  max_retries: number;
  backoff_base_ms: number;
  backoff_max_ms: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  source_id: string;
  destination_id: string;
  event_types: string;
  enabled: number;
  created_at: string;
}

export interface Event {
  id: string;
  source_id: string;
  event_type: string | null;
  idempotency_key: string | null;
  payload_r2_key: string | null;
  headers: string | null;
  received_at: string;
}

// Export/Import format — used by CLI migrate, export, import commands
export interface ExportData {
  version: "1";
  exported_at: string;
  instance_url?: string;
  sources: Source[];
  destinations: Destination[];
  subscriptions: Subscription[];
}

export interface ImportResult {
  sources: { created: number; skipped: number };
  destinations: { created: number; skipped: number };
  subscriptions: { created: number; skipped: number };
}

export interface Delivery {
  id: string;
  event_id: string;
  destination_id: string;
  status: "pending" | "success" | "failed" | "dlq";
  attempt: number;
  status_code: number | null;
  latency_ms: number | null;
  response_body: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}
