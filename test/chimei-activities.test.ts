import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChimeiActivities } from '../src/sources/chimei-activities.ts';

const workshop = { id: 207, title: '西洋武術大師工作坊',
  date: '2026/10/31 (六)<br />長劍 09:30-12:30<br>2026/09/14 中午啟售',
  link: 'https://www.chimeimuseum.org/event/6a9e550542b15', type: null, tag: '' };

test('奇美活動保留館方完整時間文字，與限期特展分流', () => {
  const result = classifyChimeiActivities({ expoEvent: [workshop] }, '2026-10-11T06:00:00Z');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].dateText, '2026/10/31 (六)\n長劍 09:30-12:30\n2026/09/14 中午啟售');
  assert.equal(result.items[0].sourceUrl, workshop.link);
});

test('奇美活動拒絕空清單、重複 ID 與非官方詳情連結', () => {
  assert.throws(() => classifyChimeiActivities({ expoEvent: [] }, '2026-10-11T06:00:00Z'));
  assert.throws(() => classifyChimeiActivities({ expoEvent: [workshop, workshop] }, '2026-10-11T06:00:00Z'));
  assert.throws(() => classifyChimeiActivities({ expoEvent: [{ ...workshop,
    link: 'https://example.com/event/6a9e550542b15' }] }, '2026-10-11T06:00:00Z'));
});
