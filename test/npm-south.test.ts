import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeNpmSouthPages, parseNpmSouthPage } from '../src/sources/npm-south.ts';

const card = (id: number, cond: string, title: string, dates: string[], venue = 'S302 3F') => `<div class="kf_imglist">
  <a href="ExhibitionsDetailC003110.aspx?Cond=${cond}&amp;appname=Exhibition3112"
     id="ContentPlaceHolder1_ucExhibitionsList_repList_aLinkDetail_${id}" title="${title}">
    <div class="kf_imglist_time">${dates.map((date) => `<span>${date}</span>`).join('')}</div>
    <div class="kf_imglist_tit2">${title}</div><div class="remarks remarks_ic-map">${venue}</div>
  </a></div>`;

const cond = 'ac20c438-1a48-4f54-8484-fd437bef211f';

test('故宮南院民國展期轉西元，無結束日的常設展不匯入', () => {
  const rows = parseNpmSouthPage(card(1, cond, '天團降臨：藝術中的仙佛組合', ['115-09-08', '115-12-06'])
    + card(2, '9963f5e2-df38-4cb3-bfdf-b689c14ca3f7', '東亞茶文化', ['110-03-20']));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].startDate, '2026-09-08');
  assert.equal(rows[0].endDate, '2026-12-06');
  assert.equal(rows[0].sourceUrl, `https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=${cond}`);
});

test('當期與預告同一館方詳情頁只留一筆，來源格式錯誤則失敗', () => {
  const html = card(1, cond, '天團降臨', ['115-09-08', '115-12-06']);
  assert.equal(mergeNpmSouthPages([html, html]).length, 1);
  assert.throws(() => parseNpmSouthPage('<html>沒有展覽卡</html>'), /格式變更/);
});
