import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyNstmFeed, parseNstmList } from '../src/sources/nstm.ts';

const html = `<div class="exhi_data_list"><h3>儀相萬千：量測儀器特展</h3>
<span><i>展覽日期：</i>115-06-30 ~ 115-11-15</span>
<a href="/Exhibition.aspx?KeyID=618640c1-6a8b-431b-8ce5-19b30aa01608"
id="example_aMore" title="儀相萬千：量測儀器特展">詳細資料</a></div>`;

test('科工館 JSON 僅在官方展名與展期唯一吻合時才入庫', () => {
  const data = [
    { Category: '特展', ExhibitionName: '儀相萬千：量測儀器特展',
      ExhibitionStartDate: '20260630', ExhibitionEndDate: '20261115', Floor: '2F' },
    { Category: '特展', ExhibitionName: '另一展覽',
      ExhibitionStartDate: '20260630', ExhibitionEndDate: '20261115', Floor: '2F' },
    { Category: '常設展', ExhibitionName: '常設展',
      ExhibitionStartDate: '17530101', ExhibitionEndDate: '99991231' },
  ];
  const result = classifyNstmFeed(data, html, '2026-10-05');
  assert.equal(result.rows.length, 1);
  assert.equal(result.records.length, 2);
  assert.equal(result.rows[0].sourceUrl,
    'https://www.nstm.gov.tw/Exhibition.aspx?KeyID=618640c1-6a8b-431b-8ce5-19b30aa01608');
  assert.equal(result.records[1].status, 'review');
});

test('科工館列表格式消失或展期不符時停止公開匯入', () => {
  assert.throws(() => parseNstmList('<html>empty</html>'), /停止匯入/);
  const result = classifyNstmFeed([{ Category: '特展', ExhibitionName: '儀相萬千：量測儀器特展',
    ExhibitionStartDate: '20260630', ExhibitionEndDate: '20261231' }], html, '2026-10-05');
  assert.equal(result.rows.length, 0);
  assert.equal(result.records[0].status, 'review');
});
