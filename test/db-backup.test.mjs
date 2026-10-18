import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertRestoreTarget, connectionParts } from '../scripts/db-backup.mjs';

test('backup connection parses password without putting it in process arguments', () => {
  const parts = connectionParts('postgresql://reader:p%40ss@db.example:5433/event_radar?sslmode=require&channel_binding=require');
  assert.equal(parts.password, 'p@ss');
  assert.equal(parts.database, 'event_radar');
  assert.equal(parts.sslMode, 'require');
  assert.equal(parts.channelBinding, 'require');
});

test('restore check requires a separate explicitly named database', () => {
  const source = 'postgresql://user:secret@localhost/event_radar';
  assert.throws(() => assertRestoreTarget(source, source), /隔離資料庫|相同/);
  assert.throws(() => assertRestoreTarget(source, 'postgresql://user:secret@localhost/event_radar_prod'), /隔離資料庫/);
  assert.equal(assertRestoreTarget(source,
    'postgresql://user:secret@localhost/event_radar_restore_ci').database, 'event_radar_restore_ci');
});
