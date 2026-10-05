import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMocChimei, verifiedMocChimeiRows } from '../src/sources/moc-chimei.ts';

const url = 'https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a68fa1d1a3b';
const first = { UID: '68f2a6a926b324253c0da4fc', title: '大英博物館鉅獻《埃及之王：法老》',
  showUnit: '(中華民國)奇美博物館;(英國)大英博物館', sourceWebPromote: url,
  showInfo: [{ time: '2026/01/29 09:30:00', endTime: '2026/12/31 17:30:00' }] };
const second = { ...first, UID: '68f2a6a926b324253c0da4fd',
  showInfo: [{ time: '2027/01/01 09:30:00', endTime: '2027/01/10 17:30:00' }] };

test('文化部同一奇美特展相鄰分段合併，且須由館方頁確認完整展期', () => {
  const { groups, records } = classifyMocChimei([first, second]);
  const pages = new Map([[url, '<h1>大英博物館鉅獻《埃及之王：法老》</h1><p>2026.01.29 － 2027.01.10</p>']]);
  const rows = verifiedMocChimeiRows(groups, pages);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].startDate, '2026-01-29');
  assert.equal(rows[0].endDate, '2027-01-10');
  assert.equal(records[0].status, 'ready');
  assert.equal(records[1].status, 'ready');
});

test('文化部來源缺館方完整展期或指向常設展時隔離', () => {
  const { groups, records } = classifyMocChimei([first, { ...second,
    UID: '68f2a6a926b324253c0da4fe', title: '奇美常設展', sourceWebPromote: 'https://www.chimeimuseum.org/' }]);
  assert.equal(verifiedMocChimeiRows(groups, new Map([[url, '<h1>法老</h1>']])).length, 0);
  assert.equal(records[0].status, 'review');
  assert.equal(records[1].status, 'review');
});
