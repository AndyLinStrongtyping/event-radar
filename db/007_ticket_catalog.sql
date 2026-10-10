INSERT INTO museums (id,name,city,homepage_url,source_status)
VALUES ('ntsec','國立臺灣科學教育館','臺北市','https://www.ntsec.gov.tw/','planned')
ON CONFLICT (id) DO NOTHING;
