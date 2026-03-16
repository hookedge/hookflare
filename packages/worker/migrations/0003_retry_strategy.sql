-- Add retry strategy options to destinations
ALTER TABLE destinations ADD COLUMN retry_strategy TEXT NOT NULL DEFAULT 'exponential';
ALTER TABLE destinations ADD COLUMN retry_interval_ms INTEGER NOT NULL DEFAULT 60000;
ALTER TABLE destinations ADD COLUMN retry_max_interval_ms INTEGER NOT NULL DEFAULT 86400000;
ALTER TABLE destinations ADD COLUMN retry_on_status TEXT;

-- Migrate existing columns: rename for clarity
-- backoff_base_ms → retry_interval_ms (already added above with new default)
-- backoff_max_ms → retry_max_interval_ms (already added above with new default)
-- Copy existing values
UPDATE destinations SET retry_interval_ms = backoff_base_ms WHERE backoff_base_ms != 30000;
UPDATE destinations SET retry_max_interval_ms = backoff_max_ms WHERE backoff_max_ms != 86400000;
