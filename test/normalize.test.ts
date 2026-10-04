import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExhibition } from '../src/normalize.ts';

const row = {
  museumId: 'chimei', title: '測試特展', venue: '特展廳',
  startDate: '2026-01-29', endDate: '2027-01-10',
  sourceUrl: 'https://www.chimeimuseum.org/special-exhibition/example',
  summary: '測試用摘要',
};

test('官方網址與日期可正規化，同樣內容 hash 穩定', () => {
  const first = normalizeExhibition(row, 'chimei');
  assert.equal(first.city, '臺南市');
  assert.equal(first.contentHash, normalizeExhibition(row, 'chimei').contentHash);
  assert.notEqual(first.contentHash, normalizeExhibition({ ...row, endDate: '2027-01-11' }, 'chimei').contentHash);
});

test('拒絕無效展期與假冒來源', () => {
  assert.throws(() => normalizeExhibition({ ...row, startDate: '2026-02-30' }, 'chimei'));
  assert.throws(() => normalizeExhibition({ ...row, endDate: '2025-01-01' }, 'chimei'));
  assert.throws(() => normalizeExhibition({ ...row, sourceUrl: 'https://example.com/' }, 'chimei'));
  assert.throws(() => normalizeExhibition({ ...row, sourceUrl: 'http://www.chimeimuseum.org/' }, 'chimei'));
});

test('科博館假資料必須標記並使用獨立身份', () => {
  const sample = normalizeExhibition({
    museumId: 'nmns', title: '模擬特展', startDate: '2026-10-01', endDate: '2026-12-31',
    sourceUrl: 'https://www.nmns.edu.tw/ch/exhibitions/special-exhibitions/index.html',
    sourceKey: 'mock-nmns-001', isSample: true,
  }, 'nmns');
  assert.equal(sample.isSample, true);
  assert.equal(sample.sourceKey, 'mock-nmns-001');
  assert.throws(() => normalizeExhibition({ ...sample, museumId: 'chimei' }, 'nmns'));
});
