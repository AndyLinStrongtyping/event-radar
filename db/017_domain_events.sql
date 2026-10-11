-- Performances and daily marine programmes do not inherit exhibition date-range semantics.
CREATE TABLE domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('performance','marine')),
  title TEXT NOT NULL,
  venue TEXT,
  source_url TEXT NOT NULL,
  ticket_url TEXT,
  price_note TEXT,
  source_checked_at TIMESTAMPTZ NOT NULL,
  observed_on DATE,
  content_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id,source_key),
  CHECK ((domain='marine' AND observed_on IS NOT NULL)
    OR (domain='performance' AND observed_on IS NULL))
);

CREATE TABLE event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  session_key TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  hall TEXT,
  ticket_url TEXT,
  price_min INTEGER CHECK (price_min >= 0),
  price_max INTEGER CHECK (price_max >= 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK
    (status IN ('scheduled','sold_out','cancelled','postponed','unknown')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id,session_key),
  CHECK (price_min IS NULL OR price_max IS NULL OR price_max >= price_min)
);
CREATE INDEX event_sessions_start_idx ON event_sessions(starts_at,event_id);

CREATE TABLE recurring_schedules (
  event_id UUID NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  local_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei' CHECK (timezone='Asia/Taipei'),
  recurrence TEXT NOT NULL CHECK (recurrence='daily'),
  duration_minutes INTEGER CHECK (duration_minutes > 0 AND duration_minutes <= 240),
  venue TEXT,
  PRIMARY KEY (event_id,local_time)
);

CREATE TABLE domain_event_changes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX domain_event_changes_event_idx ON domain_event_changes(event_id,detected_at DESC,id DESC);

CREATE TABLE domain_source_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('single_detail','sampled_list','daily_page')),
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed')),
  fetched_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
