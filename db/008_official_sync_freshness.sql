BEGIN;

ALTER TABLE museums ADD COLUMN IF NOT EXISTS last_official_success_at TIMESTAMPTZ;

-- Only recorded successful official sync attempts prove that an older timestamp
-- came from an official fetch. Previous manual imports must not be backfilled.
UPDATE museums m SET last_official_success_at = attempts.last_succeeded_at
FROM (
  SELECT museum_id, max(created_at) AS last_succeeded_at
  FROM sync_attempts WHERE status='succeeded' GROUP BY museum_id
) attempts
WHERE m.id=attempts.museum_id AND m.last_official_success_at IS NULL;

COMMIT;
