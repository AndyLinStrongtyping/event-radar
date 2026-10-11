CREATE TABLE programme_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id TEXT NOT NULL REFERENCES museums(id),
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  raw_date TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN
    ('date_range','multiple_dates','ongoing','time_only','unknown')),
  start_date DATE,
  end_date DATE,
  event_type TEXT,
  source_url TEXT NOT NULL,
  content_hash CHAR(64) NOT NULL,
  last_checked_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT programme_events_source_identity UNIQUE
    (museum_id,provider,source_type,source_event_id),
  CONSTRAINT programme_events_dates CHECK (
    (schedule_type = 'date_range' AND start_date IS NOT NULL AND end_date IS NOT NULL
      AND end_date >= start_date)
    OR (schedule_type <> 'date_range' AND start_date IS NULL AND end_date IS NULL))
);

CREATE TABLE programme_event_changes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES programme_events(id),
  field_name TEXT NOT NULL CHECK (field_name IN
    ('title','rawDate','scheduleType','startDate','endDate','eventType','sourceUrl')),
  old_value TEXT,
  new_value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX programme_event_changes_event_idx
  ON programme_event_changes(event_id, detected_at DESC);
