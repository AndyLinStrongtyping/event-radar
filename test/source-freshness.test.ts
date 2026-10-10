import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFreshness } from '../src/source-freshness.ts';

const now = new Date('2026-10-10T04:00:00Z');

test('人工核對與規劃中來源不宣稱同步成功', () => {
  assert.equal(sourceFreshness('curated', '2026-10-10T03:00:00Z', 'succeeded', now), 'manual');
  assert.equal(sourceFreshness('planned', null, null, now), 'planned');
});

test('最近失敗優先於之前成功；未有同步嘗試不視為新鮮', () => {
  assert.equal(sourceFreshness('open_data', '2026-10-10T03:00:00Z', 'failed', now), 'failed');
  assert.equal(sourceFreshness('open_data', '2026-10-10T03:00:00Z', null, now), 'untracked');
  assert.equal(sourceFreshness('open_data', '2026-10-02T03:00:00Z', null, now), 'stale');
  assert.equal(sourceFreshness('open_data', null, null, now), 'never');
});

test('成功匯入超過 7 天才顯示可能過期', () => {
  assert.equal(sourceFreshness('open_data', '2026-10-03T04:00:00Z', 'succeeded', now), 'recent');
  assert.equal(sourceFreshness('open_data', '2026-10-03T03:59:59Z', 'succeeded', now), 'stale');
  assert.equal(sourceFreshness('open_data', '2026-10-11T04:00:00Z', 'succeeded', now), 'untracked');
});
