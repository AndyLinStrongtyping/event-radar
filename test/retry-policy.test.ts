import assert from 'node:assert/strict';
import test from 'node:test';
import { isTransientSyncFailure, retryDelaysMs } from '../src/retry-policy.ts';

test('只對暫時性來源或連線錯誤安排有限次重試', () => {
  assert.deepEqual([...retryDelaysMs], [30_000, 120_000]);
  assert.equal(isTransientSyncFailure('來源回應 HTTP 503'), true);
  assert.equal(isTransientSyncFailure('fetch failed'), true);
  assert.equal(isTransientSyncFailure('connection terminated unexpectedly'), true);
  assert.equal(isTransientSyncFailure('展期缺少完整起訖日'), false);
  assert.equal(isTransientSyncFailure('來源鍵重複，已停止整批匯入'), false);
});
