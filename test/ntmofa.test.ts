import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyNtmofaPages } from '../src/sources/ntmofa.ts';

function card(id: string, title: string, venue: string) {
  return `<a href="https://event.culture.tw/mocweb/reg/NTMOFA/Detail.init.ctr?actId=${id}"
    class="div-activity" title="${title}"><p class="activity-time">日期：2026-09-29 ~ 2027-08-29</p>
    <p class="activity-season">地點：${venue}</p></a>`;
}
const educationTitle = '「文字跑進作品裡了!」2026藝術教育展';
const detail = `<div class="programDetailGroup"><div class="title_01">${educationTitle}</div></div>
  <p>參展藝術家：宋周妍&#12289;胡宮雪娜&#12289;胡啟仁</p><p>展覽地點︱國立臺灣美術館 B1 教育展示空間</p>
  <!--相關系列活動START--><a onclick="viewDetail('60148');">藝術家工作坊</a>
  <a onclick="viewDetail('60147');">策展導覽</a><!--相關系列活動END-->`;

test('國美館限期展只收本館展區，保留藝術家與相關活動', async () => {
  const pages = [card('60146', educationTitle, 'B1 教育展示空間')
    + card('60142', '機場文化櫥窗特展', '桃園國際機場')
    + card('60150', '時代印記：國美典藏常設展', '301展覽室'), ''];
  const result = await classifyNtmofaPages(pages, async () => detail);
  assert.equal(result.rows.length, 1);
  assert.equal(result.records.length, 3);
  assert.deepEqual(result.rows[0].art.artistNames, ['宋周妍', '胡宮雪娜', '胡啟仁']);
  assert.deepEqual(result.rows[0].art.curatorNames, []);
  assert.equal(result.rows[0].art.exhibitionType, 'education');
  assert.equal(result.rows[0].art.floor, 'B1');
  assert.equal(result.rows[0].art.relatedEvents.length, 2);
  assert.deepEqual(result.records.map((record) => record.status), ['ready', 'ignored', 'ignored']);
});

test('國美館詳情標題不合或失聯時逐筆待審，不猜測展覽', async () => {
  const pages = [card('60146', educationTitle, 'B1 教育展示空間')
    + card('60123', '國際版畫雙年展', '101及202展覽室'), ''];
  const result = await classifyNtmofaPages(pages, async (url) => {
    if (url.includes('60123')) throw new Error('detail unavailable');
    return '<div class="programDetailGroup"><div class="title_01">不同標題</div></div>';
  }).catch((error) => error);
  assert.match(String(result), /沒有可驗證/);
});

test('國美館空清單或重複來源 ID 整批停止', async () => {
  await assert.rejects(classifyNtmofaPages(['', ''], async () => detail), /格式變更/);
  await assert.rejects(classifyNtmofaPages([card('60146', educationTitle, 'B1')
    + card('60146', educationTitle, 'B1'), ''], async () => detail), /ID 重複/);
});

test('國美館單筆詳情失聯與內容驗證失敗分流，避免連線故障使舊展下架', async () => {
  const pages = [card('60146', educationTitle, 'B1 教育展示空間')
    + card('60123', '國際版畫雙年展', '101展覽室')
    + card('60124', '另一檔特展', '102展覽室'), ''];
  const result = await classifyNtmofaPages(pages, async (url) => {
    if (url.includes('60123')) throw new Error('逾時');
    if (url.includes('60124')) return '<div class="programDetailGroup"><div class="title_01">不同標題</div></div>';
    return detail;
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.records[1].status, 'review');
  assert.equal(result.records[1].preserveExisting, true);
  assert.match(result.records[1].reason!, /保留上次核對/);
  assert.equal(result.records[2].status, 'review');
  assert.notEqual(result.records[2].preserveExisting, true);
});
