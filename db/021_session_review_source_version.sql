-- A manual status applies only to the exact source event version reviewed.
-- A changed official detail makes the old review stale until checked again.
ALTER TABLE event_sessions ADD COLUMN status_source_hash CHAR(64);
UPDATE event_sessions s SET status_source_hash=d.content_hash
  FROM domain_events d WHERE d.id=s.event_id AND s.status_origin='manual';
ALTER TABLE event_sessions DROP CONSTRAINT event_sessions_status_review_check;
ALTER TABLE event_sessions ADD CONSTRAINT event_sessions_status_review_check CHECK (
  (status_origin='source' AND status_evidence_url IS NULL AND status_reviewed_at IS NULL
    AND status_reviewer IS NULL AND status_review_note IS NULL AND status_source_hash IS NULL)
  OR (status_origin='manual' AND status_evidence_url IS NOT NULL
    AND status_reviewed_at IS NOT NULL AND status_reviewer IS NOT NULL
    AND status_review_note IS NOT NULL AND status_source_hash IS NOT NULL
    AND length(status_evidence_url) <= 2048
    AND length(btrim(status_reviewer)) BETWEEN 2 AND 80
    AND length(btrim(status_review_note)) BETWEEN 20 AND 500)
);
