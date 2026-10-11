BEGIN;

-- Existing count baselines have no trustworthy historical key set. The next
-- complete official run initializes it without rewriting older run evidence.
ALTER TABLE official_source_baselines
  ADD COLUMN IF NOT EXISTS identity_keys TEXT[];

COMMIT;
