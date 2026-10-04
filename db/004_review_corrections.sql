BEGIN;

ALTER TABLE source_records DROP CONSTRAINT IF EXISTS source_records_status_check;
ALTER TABLE source_records ADD CONSTRAINT source_records_status_check
  CHECK (status IN ('ready','review','ignored','approved'));

ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS review_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_hash CHAR(64) NOT NULL,
  source_url TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  evidence_url TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (museum_id,provider,source_key)
    REFERENCES source_records(museum_id,provider,source_key),
  CHECK (end_date >= start_date)
);
ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS source_url TEXT;
CREATE INDEX IF NOT EXISTS review_corrections_latest_idx
  ON review_corrections (museum_id,provider,source_key,created_at DESC,id DESC);

COMMIT;
