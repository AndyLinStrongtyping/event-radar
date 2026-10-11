import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChimeiInternalPayload, parseChimeiSchedule } from '../src/sources/chimei-internal.ts';

const detail = 'https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a68fa1d1a3b';

function payload(specialEvent: Record<string, unknown>[]) {
  return { specialEvent, permanentEvent: [{ title: '常設展' }],
    expoEvent: [{ title: '工作坊', date: '已開課' }] };
}

test('奇美日期只接受單一有效完整展期，保留無法安全解析的分類', () => {
  assert.deepEqual(parseChimeiSchedule('2026.01.29 - 2027.01.10'),
    { type: 'date_range', startDate: '2026-01-29', endDate: '2027-01-10' });
  assert.deepEqual(parseChimeiSchedule('2026/01/29 - 2027/01/10'),
    { type: 'date_range', startDate: '2026-01-29', endDate: '2027-01-10' });
  assert.equal(parseChimeiSchedule('2026.01.29 - 2027.01.10<br />2027.02.01 - 2027.02.02').type,
    'multiple_dates');
  assert.equal(parseChimeiSchedule('即日起~2027/12/31').type, 'ongoing');
  assert.equal(parseChimeiSchedule('9:30 - 17:00（每15分鐘一場）').type, 'time_only');
  assert.equal(parseChimeiSchedule('2026.02.30 - 2027.01.10').type, 'unknown');
  assert.equal(parseChimeiSchedule('2027.01.10 - 2026.01.29').type, 'unknown');
});

test('奇美 adapter 只轉換可核對的限期特展，來源鍵不依賴可變網址', () => {
  const item = { id: 207, title: '埃及之王：法老', link: `${detail}?from=list`,
    date: '2026.01.29 - 2027.01.10', txt: '不儲存官網完整介紹', img: '/image.jpg' };
  const first = classifyChimeiInternalPayload(payload([item]));
  const second = classifyChimeiInternalPayload(payload([{ ...item,
    link: 'https://www.chimeimuseum.org/special-exhibition/new/new' }]));
  assert.equal(first.rows[0].sourceKey, 'special:207');
  assert.equal(second.rows[0].sourceKey, first.rows[0].sourceKey);
  assert.equal(first.rows[0].sourceUrl, detail);
  assert.equal(first.records[0].status, 'ready');
  assert.equal(first.counts.permanentEvent, 1);
  assert.equal(first.counts.expoEvent, 1);
  assert.equal(first.records.length, 1);
  assert.equal('txt' in first.records[0].raw, false);
  assert.equal('img' in first.records[0].raw, false);
  const shortLink = classifyChimeiInternalPayload(payload([{ ...item,
    id: '68a68f0a422a6', link: 'https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6' }]));
  assert.equal(shortLink.rows[0].sourceKey, 'special:68a68f0a422a6');
});

test('不明展期或外站網址進待審，常設展和活動不混入公開特展', () => {
  const result = classifyChimeiInternalPayload(payload([
    { id: 207, title: '多場次', link: detail,
      date: '2026.01.29 - 2027.01.10<br />2027.02.01 - 2027.02.02' },
    { id: 208, title: '外站', link: 'https://example.com/special-exhibition/a/b',
      date: '2026.01.29 - 2027.01.10' },
  ]));
  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.records.map((record) => record.status), ['review', 'review']);
  assert.match(result.records[0].reason || '', /multiple_dates/);
  assert.match(result.records[1].reason || '', /不是奇美官方/);
  assert.equal(result.records[0].raw.rawDate,
    '2026.01.29 - 2027.01.10<br />2027.02.01 - 2027.02.02');
});

test('空回應、破損 schema 或重複 ID 停止整批處理', () => {
  assert.throws(() => classifyChimeiInternalPayload({ specialEvent: [], permanentEvent: [], expoEvent: [] }),
    /皆為空/);
  assert.throws(() => classifyChimeiInternalPayload({ specialEvent: [], permanentEvent: [] }),
    /expoEvent 不是陣列/);
  const item = { id: 207, title: '埃及之王：法老', link: detail,
    date: '2026.01.29 - 2027.01.10' };
  assert.throws(() => classifyChimeiInternalPayload(payload([item, item])), /來源 ID 重複/);
});
