BEGIN;

CREATE TABLE IF NOT EXISTS source_missing_candidates (
  museum_id TEXT NOT NULL REFERENCES museums(id),
  provider TEXT NOT NULL,
  source_key TEXT NOT NULL,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  missed_runs INTEGER NOT NULL DEFAULT 1 CHECK (missed_runs >= 1),
  first_missing_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_missing_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  last_run_id UUID NOT NULL REFERENCES ingestion_runs(id),
  PRIMARY KEY (museum_id,provider,source_key)
);
CREATE INDEX IF NOT EXISTS source_missing_candidates_pending_idx
  ON source_missing_candidates(museum_id,last_missing_at DESC)
  WHERE status='pending';

ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS missing_count INTEGER NOT NULL DEFAULT 0;

COMMIT;
