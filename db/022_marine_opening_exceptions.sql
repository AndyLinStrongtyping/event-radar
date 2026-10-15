-- Date-specific, human-verified NMMBA hours. General seasonal text is not a calendar.
CREATE TABLE museum_opening_exceptions (
  museum_id TEXT NOT NULL REFERENCES museums(id),
  visit_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','closed')),
  opens_at TIME,
  closes_at TIME,
  evidence_url TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  review_note TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (museum_id,visit_date),
  CHECK ((status='closed' AND opens_at IS NULL AND closes_at IS NULL)
    OR (status='open' AND opens_at IS NOT NULL AND closes_at IS NOT NULL
      AND closes_at > opens_at))
);

CREATE TABLE museum_opening_exception_changes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  museum_id TEXT NOT NULL,
  visit_date DATE NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX museum_opening_exception_changes_date_idx
  ON museum_opening_exception_changes(museum_id,visit_date,changed_at DESC);
