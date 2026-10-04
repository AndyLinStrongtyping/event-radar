BEGIN;

INSERT INTO museums (id,name,city,homepage_url,source_status)
VALUES ('nmmba','國立海洋生物博物館','屏東縣','https://www.nmmba.gov.tw/','open_data')
ON CONFLICT (id) DO NOTHING;

UPDATE museums SET source_status='open_data' WHERE id='npm-north';

ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS source_records (
  museum_id TEXT NOT NULL REFERENCES museums(id),
  provider TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_url TEXT,
  raw_record JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready','review','ignored')),
  reason TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (museum_id,provider,source_key)
);
CREATE INDEX IF NOT EXISTS source_records_review_idx
  ON source_records (museum_id,status,last_seen_at DESC);

COMMIT;
