BEGIN;

ALTER TABLE museums DROP CONSTRAINT IF EXISTS museums_source_status_check;
ALTER TABLE museums ADD CONSTRAINT museums_source_status_check
  CHECK (source_status IN ('curated', 'open_data', 'official_page', 'planned'));
UPDATE museums SET source_status='official_page' WHERE id='npm-south';

ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS primary_provider TEXT;
UPDATE exhibitions SET primary_provider=museum_id WHERE primary_provider IS NULL;
ALTER TABLE exhibitions ALTER COLUMN primary_provider SET NOT NULL;

CREATE TABLE IF NOT EXISTS exhibition_sources (
  museum_id TEXT NOT NULL REFERENCES museums(id),
  provider TEXT NOT NULL,
  source_key TEXT NOT NULL,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (museum_id, provider, source_key)
);
CREATE INDEX IF NOT EXISTS exhibition_sources_exhibition_idx ON exhibition_sources(exhibition_id);
INSERT INTO exhibition_sources(museum_id,provider,source_key,exhibition_id)
SELECT museum_id,museum_id,source_key,id FROM exhibitions ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS exhibition_changes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id),
  ingestion_run_id UUID REFERENCES ingestion_runs(id),
  field_name TEXT NOT NULL CHECK (field_name IN
    ('title','venue','startDate','endDate','priceNote','sourceUrl','summary')),
  old_value TEXT,
  new_value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exhibition_changes_exhibition_idx
  ON exhibition_changes(exhibition_id,detected_at DESC);

ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS unchanged_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS linked_count INTEGER NOT NULL DEFAULT 0;

COMMIT;
