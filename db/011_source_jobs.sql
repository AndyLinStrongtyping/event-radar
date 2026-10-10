BEGIN;

CREATE TABLE IF NOT EXISTS source_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  museum_id TEXT NOT NULL REFERENCES museums(id),
  job_type TEXT NOT NULL DEFAULT 'FETCH_SOURCE' CHECK (job_type='FETCH_SOURCE'),
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','succeeded','dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts=3),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  lease_until TIMESTAMPTZ,
  worker_token UUID,
  last_error TEXT,
  replay_of UUID REFERENCES source_jobs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_jobs_due_idx
  ON source_jobs(available_at,created_at,id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS source_jobs_expired_idx
  ON source_jobs(lease_until,id) WHERE status='running';

COMMIT;
