-- Evidence for operator-approved marine list changes; no automatic deletion or cancellation inference.
ALTER TABLE domain_source_runs DROP CONSTRAINT domain_source_runs_identity_keys_scope_check;
ALTER TABLE domain_source_runs ADD CONSTRAINT domain_source_runs_identity_keys_scope_check
  CHECK (identity_keys IS NULL OR scope IN ('ntt_place1_list','daily_page'));
ALTER TABLE domain_source_runs ADD COLUMN review_evidence_url TEXT;
ALTER TABLE domain_source_runs ADD COLUMN reviewer TEXT;
ALTER TABLE domain_source_runs ADD CONSTRAINT domain_source_runs_review_pair_check
  CHECK ((review_evidence_url IS NULL AND reviewer IS NULL)
    OR (review_evidence_url IS NOT NULL AND reviewer IS NOT NULL AND review_note IS NOT NULL));
