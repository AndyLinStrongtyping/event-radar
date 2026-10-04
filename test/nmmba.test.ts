import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyNmmbaFeed, parseNmmbaDate } from '../src/sources/nmmba.ts';

test('海生館民國與西元日期須符合真實日曆', () => {
  assert.equal(parseNmmbaDate('1150618'), '2026-06-18');
  assert.equal(parseNmmbaDate('1141204'), '2025-12-04');
  assert.equal(parseNmmbaDate('2023-12-15'), '2023-12-15');
  assert.equal(parseNmmbaDate('20261004'), '2026-10-04');
  assert.throws(() => parseNmmbaDate('1150230'), /無效日期/);
  assert.throws(() => parseNmmbaDate('2026-13-01'), /無效日期/);
  assert.throws(() => parseNmmbaDate(''), /缺少展期/);
});

test('完整特展可匯入；缺日期及非館方網址只進待審', () => {
  const base = { '特展名稱': '海洋特展', '展出地點': '特展廳',
    'app用開始時間': '1150618', 'app用結束時間': '1160301' };
  const result = classifyNmmbaFeed([
    { ...base, Source: 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=ok' },
    { ...base, Source: 'https://www.nmmba.gov.tw/News_Content.aspx?n=3&s=missing', 'app用結束時間': '' },
    { ...base, Source: 'https://example.com/untrusted' },
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].startDate, '2026-06-18');
  assert.deepEqual(result.records.map((record) => record.status), ['ready', 'review', 'review']);
  assert.match(result.records[1].reason!, /缺少展期/);
  assert.match(result.records[2].reason!, /官方 HTTPS/);
});
