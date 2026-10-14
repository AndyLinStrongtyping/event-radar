-- Keep official place=1 list baselines separate from operator-provided snapshots.
ALTER TABLE domain_source_runs DROP CONSTRAINT domain_source_runs_scope_check;
ALTER TABLE domain_source_runs ADD CONSTRAINT domain_source_runs_scope_check
  CHECK (scope IN ('single_detail','sampled_list','daily_page','ntt_place1_list'));
ALTER TABLE domain_source_runs ADD COLUMN review_note TEXT
  CHECK (review_note IS NULL OR length(btrim(review_note)) BETWEEN 20 AND 500);
