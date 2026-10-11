import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeChimeiProgramme, parseChimeiProgrammeDate } from '../src/chimei-programmes.ts';

test('奇美活動只解析明確完整範圍，其餘保留原文與可空日期', () => {
  assert.deepEqual(parseChimeiProgrammeDate('2026/01/29 - 2027/01/10\n博物館開放日'),
    { scheduleType: 'date_range', startDate: '2026-01-29', endDate: '2027-01-10' });
  assert.deepEqual(parseChimeiProgrammeDate('2026/02/30 - 2027/01/10'),
    { scheduleType: 'unknown', startDate: null, endDate: null });
  assert.equal(parseChimeiProgrammeDate('2026\n09/05 14:30\n09/12 14:30').scheduleType,
    'multiple_dates');
  assert.equal(parseChimeiProgrammeDate('2026/10/31 (六)\n2026/09/14 中午啟售').scheduleType,
    'unknown', '售票日期不可誤認為另一活動場次');
  assert.equal(parseChimeiProgrammeDate('即日起~2027/12/31').scheduleType, 'ongoing');
  assert.equal(parseChimeiProgrammeDate('9:30 - 17:00（每15分鐘一場）').scheduleType,
    'time_only');
});

test('奇美活動正規化保留來源 ID，拒絕非官方連結', () => {
  const item = { id: '207', title: '西洋武術', dateText: '2026/10/31\n2026/09/14 啟售',
    type: null, sourceUrl: 'https://www.chimeimuseum.org/event/6a9e550542b15' };
  const normalized = normalizeChimeiProgramme(item);
  assert.equal(normalized.id, '207');
  assert.equal(normalized.scheduleType, 'unknown');
  assert.match(normalized.contentHash, /^[a-f0-9]{64}$/);
  assert.throws(() => normalizeChimeiProgramme({ ...item,
    sourceUrl: 'https://example.com/event/6a9e550542b15' }));
});
