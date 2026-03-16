-- Add provider field to sources.
-- References the provider catalog (e.g. "stripe", "github").
-- NULL means generic/custom webhook source (no provider).
ALTER TABLE sources ADD COLUMN provider TEXT;
