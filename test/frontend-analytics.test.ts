import assert from 'node:assert/strict';
import test from 'node:test';
import { trackExhibitionDetailOpen, trackExhibitionSearchCompleted, trackOfficialExhibitionClick } from '../frontend/src/analytics.ts';

test('搜尋追蹤只在有 GA4 時送出完成事件，不包含使用者輸入', () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const events: unknown[][] = [];
  (globalThis as { window?: unknown }).window = { gtag: (...args: unknown[]) => events.push(args) };
  try {
    trackExhibitionSearchCompleted({ q: '私人姓名與電話 0912345678', city: '臺中市', museum: 'ntmofa', status: 'active', admission: 'all', asOf: '2026-10-25', includeSample: false }, 3);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0]?.slice(0, 2), ['event', 'exhibition_search_complete']);
    const payload = JSON.stringify(events[0]?.[2]);
    assert.equal(payload.includes('私人姓名'), false);
    assert.equal(payload.includes('0912345678'), false);
    assert.equal(payload.includes('2026-10-25'), false);
    assert.match(payload, /"result_count":3/);
  } finally {
    (globalThis as { window?: unknown }).window = previousWindow;
  }
});

test('展覽互動不送出標題或外部網址，測試資料不計入', () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const events: unknown[][] = [];
  (globalThis as { window?: unknown }).window = { gtag: (...args: unknown[]) => events.push(args) };
  try {
    const item = { id: 'stable-id', museumId: 'chimei', sourceStatus: 'curated', exhibitionStatus: 'ongoing', isSample: false, title: '私人展名', sourceUrl: 'https://example.com/private' };
    trackExhibitionDetailOpen(item);
    trackOfficialExhibitionClick(item);
    trackExhibitionDetailOpen({ ...item, isSample: true });
    assert.deepEqual(events.map((event) => event[1]), ['exhibition_detail_open', 'official_exhibition_click']);
    assert.equal(JSON.stringify(events).includes('私人展名'), false);
    assert.equal(JSON.stringify(events).includes('example.com'), false);
  } finally {
    (globalThis as { window?: unknown }).window = previousWindow;
  }
});
