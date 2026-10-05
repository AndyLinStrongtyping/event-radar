BEGIN;

CREATE TABLE IF NOT EXISTS sync_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sync_id UUID NOT NULL,
  museum_id TEXT NOT NULL REFERENCES museums(id),
  attempt_no INTEGER NOT NULL CHECK (attempt_no BETWEEN 1 AND 10),
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed')),
  retryable BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sync_id,attempt_no)
);
CREATE INDEX IF NOT EXISTS sync_attempts_latest_idx
  ON sync_attempts (museum_id,created_at DESC,id DESC);

COMMIT;
