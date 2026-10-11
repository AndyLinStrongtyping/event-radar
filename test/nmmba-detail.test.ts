import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyNmmbaFeed } from '../src/sources/nmmba.ts';
import { nmmbaLabelledDateRange, verifyNmmbaDetails } from '../src/sources/nmmba-detail.ts';

const url = 'https://www.nmmba.gov.tw/News_Content.aspx?n=3BA711487C292039&s=5782585BC788F20F';
const description = '<p>SEA YOU《海洋的見證與再造》</p><p>🕒 展出日期｜115年 4 月 2 日至 6 月 28 日</p>';
const raw = { Source: url, '特展名稱': 'SEA YOU《海洋的見證與再造》',
  '特展內容': description, '展出地點': '遊客中心', 'app用開始時間': '', 'app用結束時間': '' };

test('僅接受有標籤、完整且唯一的真實展期', () => {
  assert.deepEqual(nmmbaLabelledDateRange(description),
    { startDate: '2026-04-02', endDate: '2026-06-28' });
  assert.equal(nmmbaLabelledDateRange('2020年擱淺；永久典藏'), null);
  assert.equal(nmmbaLabelledDateRange('展出日期｜115年 4 月 2 日起'), null);
  assert.equal(nmmbaLabelledDateRange('展出日期｜115年 12 月 2 日至 1 月 2 日'), null);
  assert.equal(nmmbaLabelledDateRange('展出日期｜115年 2 月 30 日至 3 月 2 日'), null);
  assert.equal(nmmbaLabelledDateRange(`${description}${description}`), null);
});

test('JSON 與館方逐筆頁的展名和完整日期一致才補正', async () => {
  const batch = classifyNmmbaFeed([raw]);
  let requested = '';
  await verifyNmmbaDetails(batch, async (detailUrl) => {
    requested = detailUrl;
    return `<title>${raw['特展名稱']}</title>${description}`;
  });
  assert.equal(requested, url);
  assert.equal(batch.rows.length, 1);
  assert.equal(batch.rows[0].startDate, '2026-04-02');
  assert.equal(batch.rows[0].endDate, '2026-06-28');
  assert.equal(batch.records[0].status, 'ready');
});

test('頁面不一致、請求失敗、非官方網址及原日期矛盾都維持待審', async () => {
  for (const item of [
    raw,
    { ...raw, Source: 'https://example.com/detail' },
    { ...raw, 'app用開始時間': '1150403' },
  ]) {
    const batch = classifyNmmbaFeed([item]);
    await verifyNmmbaDetails(batch, async () => '<title>其他特展</title>' + description);
    assert.equal(batch.rows.length, 0);
    assert.equal(batch.records[0].status, 'review');
  }
  const contradictory = classifyNmmbaFeed([{ ...raw, 'app用開始時間': '1150403' }]);
  await verifyNmmbaDetails(contradictory, async () => `<title>${raw['特展名稱']}</title>${description}`);
  assert.equal(contradictory.rows.length, 0);
  const unavailable = classifyNmmbaFeed([raw]);
  await verifyNmmbaDetails(unavailable, async () => { throw new Error('HTTP 503'); });
  assert.equal(unavailable.rows.length, 0);
  assert.equal(unavailable.records[0].status, 'review');
});

test('沒有標示完整展期的舊紀錄不逐頁請求', async () => {
  const batch = classifyNmmbaFeed([{ ...raw, '特展內容': '2009年至今的海洋研究' }]);
  await verifyNmmbaDetails(batch, async () => { throw new Error('不應請求'); });
  assert.equal(batch.rows.length, 0);
  assert.equal(batch.records[0].status, 'review');
});
