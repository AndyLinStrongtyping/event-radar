-- Store the accepted identities for each official list run, without changing older baselines.
ALTER TABLE domain_source_runs ADD COLUMN identity_keys TEXT[];
ALTER TABLE domain_source_runs ADD CONSTRAINT domain_source_runs_identity_keys_scope_check
  CHECK (identity_keys IS NULL OR scope='ntt_place1_list');
