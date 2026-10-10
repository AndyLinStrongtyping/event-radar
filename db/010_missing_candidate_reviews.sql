BEGIN;

ALTER TABLE source_missing_candidates
  ADD COLUMN IF NOT EXISTS reviewed_missed_runs INTEGER NOT NULL DEFAULT 0
    CHECK (reviewed_missed_runs >= 0),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS source_missing_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  source_key TEXT NOT NULL,
  observed_missed_runs INTEGER NOT NULL CHECK (observed_missed_runs >= 1),
  decision TEXT NOT NULL CHECK (decision IN ('keep_visible','follow_up')),
  evidence_url TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (museum_id,provider,source_key)
    REFERENCES source_missing_candidates(museum_id,provider,source_key)
);

COMMIT;
