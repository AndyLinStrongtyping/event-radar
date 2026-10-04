CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE museums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  homepage_url TEXT NOT NULL,
  source_status TEXT NOT NULL CHECK (source_status IN ('curated', 'open_data', 'planned')),
  last_success_at TIMESTAMPTZ
);

CREATE TABLE exhibitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id TEXT NOT NULL REFERENCES museums(id),
  source_key TEXT NOT NULL,
  title TEXT NOT NULL,
  venue TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_note TEXT,
  source_url TEXT NOT NULL,
  summary TEXT,
  is_sample BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exhibitions_source_identity UNIQUE (museum_id, source_key),
  CONSTRAINT exhibitions_valid_dates CHECK (end_date >= start_date)
);

CREATE INDEX exhibitions_dates_idx ON exhibitions (end_date, start_date, id);
CREATE INDEX exhibitions_title_idx ON exhibitions USING GIN (to_tsvector('simple', title));

CREATE TABLE ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id TEXT NOT NULL REFERENCES museums(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  fetched_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

INSERT INTO museums (id, name, city, homepage_url, source_status) VALUES
('chimei', '奇美博物館', '臺南市', 'https://www.chimeimuseum.org/', 'curated'),
('nmns', '國立自然科學博物館', '臺中市', 'https://www.nmns.edu.tw/', 'open_data'),
('ntm', '國立臺灣博物館', '臺北市', 'https://www.ntm.gov.tw/', 'planned'),
('npm-north', '國立故宮博物院北部院區', '臺北市', 'https://www.npm.gov.tw/', 'planned'),
('npm-south', '國立故宮博物院南部院區', '嘉義縣', 'https://south.npm.gov.tw/', 'planned'),
('nmth', '國立臺灣歷史博物館', '臺南市', 'https://www.nmth.gov.tw/', 'planned'),
('nstm', '國立科學工藝博物館', '高雄市', 'https://www.nstm.gov.tw/', 'planned'),
('ntmofa', '國立臺灣美術館', '臺中市', 'https://www.ntmofa.gov.tw/', 'planned'),
('tnam', '臺南市美術館', '臺南市', 'https://www.tnam.museum/', 'planned');
