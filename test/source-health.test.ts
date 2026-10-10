import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceHealth } from '../src/source-health.ts';

const now = new Date('2026-10-10T04:00:00Z');
const base = {
  sourceStatus: 'open_data', lastOfficialSuccessAt: '2026-10-10T03:00:00Z',
  lastAttemptStatus: 'succeeded', pendingReview: 0, missingNeedsReview: 0,
};

test('來源失敗與過期優先於人工待審；重試後成功不算失敗', () => {
  assert.equal(sourceHealth({ ...base, lastAttemptStatus: 'failed', pendingReview: 1 }, now), 'failed');
  assert.equal(sourceHealth({ ...base, lastOfficialSuccessAt: '2026-10-01T03:00:00Z',
    missingNeedsReview: 1 }, now), 'stale');
  assert.equal(sourceHealth({ ...base, pendingReview: 1 }, now), 'needs_review');
  assert.equal(sourceHealth({ ...base, missingNeedsReview: 1 }, now), 'needs_review');
  assert.equal(sourceHealth(base, now), 'healthy');
});

test('無官方成功或缺工作證據不能顯示正常', () => {
  assert.equal(sourceHealth({ ...base, lastOfficialSuccessAt: null }, now), 'never');
  assert.equal(sourceHealth({ ...base, lastAttemptStatus: null }, now), 'untracked');
});
