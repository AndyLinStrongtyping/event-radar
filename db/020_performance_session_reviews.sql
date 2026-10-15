-- Preserve operator-verified session status across source refreshes without
-- pretending that the event-level booking button describes each session.
ALTER TABLE event_sessions
  ADD COLUMN status_origin TEXT NOT NULL DEFAULT 'source'
    CHECK (status_origin IN ('source','manual')),
  ADD COLUMN status_evidence_url TEXT,
  ADD COLUMN status_reviewed_at TIMESTAMPTZ,
  ADD COLUMN status_reviewer TEXT,
  ADD COLUMN status_review_note TEXT,
  ADD CONSTRAINT event_sessions_status_review_check CHECK (
    (status_origin='source' AND status_evidence_url IS NULL AND status_reviewed_at IS NULL
      AND status_reviewer IS NULL AND status_review_note IS NULL)
    OR (status_origin='manual' AND status_evidence_url IS NOT NULL
      AND status_reviewed_at IS NOT NULL AND status_reviewer IS NOT NULL
      AND status_review_note IS NOT NULL
      AND length(status_evidence_url) <= 2048
      AND length(btrim(status_reviewer)) BETWEEN 2 AND 80
      AND length(btrim(status_review_note)) BETWEEN 20 AND 500)
  );
