BEGIN;
UPDATE museums SET source_status='open_data' WHERE id='nstm';
COMMIT;
