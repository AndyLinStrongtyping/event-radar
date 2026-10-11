BEGIN;

-- Historic runs cannot be reconstructed reliably; only new official runs can
-- become a reviewed replacement baseline.
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS source_identity_keys TEXT[];

CREATE TABLE IF NOT EXISTS source_baseline_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id TEXT NOT NULL REFERENCES museums(id),
  provider TEXT NOT NULL,
  ingestion_run_id UUID NOT NULL UNIQUE REFERENCES ingestion_runs(id),
  previous_run_id UUID NOT NULL REFERENCES ingestion_runs(id),
  previous_identity_count INTEGER NOT NULL CHECK (previous_identity_count > 0),
  previous_row_count INTEGER NOT NULL CHECK (previous_row_count > 0),
  previous_identity_keys TEXT[],
  accepted_identity_count INTEGER NOT NULL CHECK (accepted_identity_count > 0),
  accepted_row_count INTEGER NOT NULL CHECK (accepted_row_count > 0),
  accepted_identity_keys TEXT[] NOT NULL,
  evidence_url TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  note TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
