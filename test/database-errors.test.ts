import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { handleIdlePoolErrors } from '../src/database-errors.ts';

test('閒置連線錯誤不拋出未處理事件，也不記錄原始連線資訊', async () => {
  const pool = new pg.Pool();
  const messages: string[] = [];
  handleIdlePoolErrors(pool, (message) => { messages.push(message); });
  assert.doesNotThrow(() => pool.emit('error', new Error('postgres://user:secret@example/db')));
  assert.equal(messages.length, 1);
  assert.match(messages[0], /閒置連線中斷/);
  assert.doesNotMatch(messages[0], /secret|example|postgres:/);
  await pool.end();
});
