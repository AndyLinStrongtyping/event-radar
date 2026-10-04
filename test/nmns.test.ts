import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNmnsFeed } from '../src/sources/nmns.ts';

test('公開特展 JSON 對應展期與官方連結', () => {
  const [row] = normalizeNmnsFeed({ success: true, itemList: [{
    title: '測試用科博館展覽', location: '第一特展室',
    dateStart: '2026/06/04', dateEnd: '2027/04/06',
    url: 'https://www.nmns.edu.tw/ch/exhibitions/special-exhibitions/Exhibition-000611/',
  }] });
  assert.equal(row.museumId, 'nmns');
  assert.equal(row.startDate, '2026-06-04');
  assert.equal(row.endDate, '2027-04-06');
  assert.equal(row.isSample, false);
});

test('拒絕錯誤的資料結構或假冒網址', () => {
  assert.throws(() => normalizeNmnsFeed({ success: false, itemList: [] }));
  assert.throws(() => normalizeNmnsFeed({ success: true, itemList: [{
    title: '錯誤網址', dateStart: '2026/06/04', dateEnd: '2027/04/06', url: 'https://example.com/',
  }] }));
});
