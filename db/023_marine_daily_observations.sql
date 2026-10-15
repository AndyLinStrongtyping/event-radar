-- Immutable programme content per observed day; repeated identical reads only refresh last_seen_at.
CREATE TABLE marine_daily_observations (
  source_id TEXT NOT NULL,
  observed_on DATE NOT NULL,
  snapshot_hash CHAR(64) NOT NULL,
  items JSONB NOT NULL CHECK (jsonb_typeof(items)='array' AND jsonb_array_length(items)>0),
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (source_id,observed_on,snapshot_hash),
  CHECK (last_seen_at >= first_seen_at)
);
CREATE INDEX marine_daily_observations_day_idx
  ON marine_daily_observations(source_id,observed_on DESC,last_seen_at DESC);
