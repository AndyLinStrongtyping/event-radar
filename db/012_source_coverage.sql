BEGIN;

CREATE TABLE IF NOT EXISTS official_source_baselines (
  museum_id TEXT NOT NULL REFERENCES museums(id),
  provider TEXT NOT NULL,
  identity_count INTEGER NOT NULL CHECK (identity_count > 0),
  row_count INTEGER NOT NULL CHECK (row_count > 0),
  last_run_id UUID NOT NULL REFERENCES ingestion_runs(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (museum_id, provider)
);

ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS source_identity_count INTEGER;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS source_row_count INTEGER;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS coverage_baseline_count INTEGER;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS coverage_baseline_row_count INTEGER;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS coverage_status TEXT NOT NULL DEFAULT 'not_applicable'
  CHECK (coverage_status IN ('not_applicable','baseline_created','checked','deferred_partial'));

COMMIT;
