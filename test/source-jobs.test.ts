import test from 'node:test';
import assert from 'node:assert/strict';
import { taiwanDate, validRunDate } from '../src/source-jobs.ts';

test('來源工作日期以臺灣日界線建立，拒絕不存在的日期', () => {
  assert.equal(taiwanDate(new Date('2026-10-09T16:05:00Z')), '2026-10-10');
  assert.equal(validRunDate('2026-10-10'), true);
  assert.equal(validRunDate('2026-02-30'), false);
  assert.equal(validRunDate('2026/10/10'), false);
});
