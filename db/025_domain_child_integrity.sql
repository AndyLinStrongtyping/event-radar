-- Domain-specific child rows must belong to a parent of the matching domain.
-- Keep the parent identity generic so future sources can reuse either domain.
ALTER TABLE domain_events
  ADD CONSTRAINT domain_events_id_domain_key UNIQUE (id, domain);

ALTER TABLE event_sessions
  ADD COLUMN domain TEXT NOT NULL DEFAULT 'performance'
    CHECK (domain = 'performance'),
  ADD CONSTRAINT event_sessions_parent_domain_fk
    FOREIGN KEY (event_id, domain) REFERENCES domain_events(id, domain) ON DELETE CASCADE;

ALTER TABLE recurring_schedules
  ADD COLUMN domain TEXT NOT NULL DEFAULT 'marine'
    CHECK (domain = 'marine'),
  ADD CONSTRAINT recurring_schedules_parent_domain_fk
    FOREIGN KEY (event_id, domain) REFERENCES domain_events(id, domain) ON DELETE CASCADE;
