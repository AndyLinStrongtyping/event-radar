ALTER TABLE museums ADD COLUMN venue_type TEXT NOT NULL DEFAULT 'museum'
  CHECK (venue_type IN ('museum', 'art_museum'));
UPDATE museums SET venue_type='art_museum',source_status='official_page' WHERE id='ntmofa';

CREATE TABLE art_exhibition_details (
  exhibition_id UUID PRIMARY KEY REFERENCES exhibitions(id) ON DELETE CASCADE,
  artist_names JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(artist_names)='array'),
  curator_names JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(curator_names)='array'),
  exhibition_type TEXT NOT NULL CHECK (exhibition_type IN ('temporary','education','biennial')),
  venue_area TEXT,
  floor TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE art_related_events (
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('lecture','guided_tour','workshop','other')),
  PRIMARY KEY (exhibition_id,source_url)
);

CREATE TABLE art_exhibition_changes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  ingestion_run_id UUID NOT NULL REFERENCES ingestion_runs(id),
  field_name TEXT NOT NULL CHECK (field_name IN
    ('artistNames','curatorNames','exhibitionType','venueArea','floor','relatedEvents')),
  old_value JSONB,
  new_value JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX art_exhibition_changes_event_idx ON art_exhibition_changes(exhibition_id,detected_at DESC);
