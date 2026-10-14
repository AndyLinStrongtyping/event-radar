import test from 'node:test';
import assert from 'node:assert/strict';
import { nttDetailUrls, parseNttDetail } from '../src/sources/ntt-events.ts';
import { parseNmmbaProgrammes } from '../src/sources/nmmba-programmes.ts';
import { severeDailyShrink, severeOfficialListShrink } from '../src/domain-events.ts';

test('海生館每日清單大幅縮水須隔離，但小幅自然變動可繼續核對', () => {
  assert.equal(severeDailyShrink(9, 4), true);
  assert.equal(severeDailyShrink(9, 5), false);
  assert.equal(severeDailyShrink(3, 1), false, '少量基準不可輕易判為異常');
});

test('歌劇院官方清單只在已有足夠基準且突然少於一半時要求覆核', () => {
  assert.equal(severeOfficialListShrink(20, 9), true);
  assert.equal(severeOfficialListShrink(20, 10), false);
  assert.equal(severeOfficialListShrink(9, 1), false, '少量基準不適合用比例判定');
});

test('歌劇院節目詳情轉成兩個獨立場次，不臆測售罄', () => {
  const url = 'https://www.npac-ntt.org/program/events/c-tv0mE3YHxoF';
  const html = `<input id="txtSubject" value="測試演出"><div class="post-place">大劇院</div>
    <div class="event-time"><span>2026/10/29<b>(四)</b>19:30</span>
    <span>2026/10/30<b>(五)</b>19:30</span></div>
    <a class="btn-buy-ticket" href="https://npacntt.tw/ticket">購票</a>
    <div class="info-title">票價</div><div class="info-cont">平日場 500，假日場 600</div>`;
  const parsed = parseNttDetail(html,url);
  assert.equal(parsed.sessions.length,2);
  assert.deepEqual(parsed.sessions.map((item) => item.status),['scheduled','scheduled']);
  assert.equal(parsed.sessions[0].priceMin,null,'不同日期票價不能合併成單場精確票價');
  assert.equal(parsed.sourceKey,'c-tv0mE3YHxoF');
  assert.deepEqual(nttDetailUrls(`<a class="img-link img-cover" href="/program/events/c-tv0mE3YHxoF">A</a>`),[url]);
  assert.throws(() => parseNttDetail(html,url.replace('www.npac-ntt.org','other.example')), /官方/);
  assert.throws(() => parseNttDetail(html.replace('2026/10/29','2026/02/30'),url), /日期無效/);
});

test('歌劇院初始清單不默默截成五筆，超過匯入上限則停止', () => {
  const cards = Array.from({ length: 6 }, (_, index) =>
    `<a class="img-link img-cover" href="/program/events/c-test${String(index).padStart(8, '0')}">節目</a>`).join('');
  const urls = nttDetailUrls(cards);
  assert.equal(urls.length, 6);
  assert.throws(() => nttDetailUrls(cards, 5), /超過安全上限/);
  assert.deepEqual(nttDetailUrls(cards + cards), urls, '同一清單的重複連結不重抓');
});

test('歌劇院 MORE 預藏卡片一併擷取，載入行為改變時停止匯入', () => {
  const html = `<div id="glch"><div class="col-md-4"><a class="img-link img-cover"
    href="/program/events/c-test00000001">A</a></div><div class="col-md-4 hide" hidden>
    <a class="img-link img-cover" href="/program/events/c-test00000002">B</a></div></div>
    <button id="btn-more">MORE</button><script>
    $('#btn-more').on('click', function() {
      $("#glch > div[class*='hide']").each(function() {
        $(this).removeClass('hide'); $(this)[0].hidden = false;
      });
    });</script>`;
  assert.equal(nttDetailUrls(html).length, 2);
  assert.throws(() => nttDetailUrls(html.replace(".removeClass('hide')", '.loadMore()')),
    /MORE 載入方式已變/);
});

test('海生館每日節目只接受可核對的日期、場次數與地點', () => {
  const card = `<li><img src="/x.jpg"><ul class="my-card"><li><h3>大洋池餵食</h3></li>
    <li class="hide-obj"><span>時間：</span>每日2場，10:00、13:00</li>
    <li><span>持續時間：</span>約15分</li><li><span>地點：</span>大洋池</li></ul></li>`;
  const html = `<p>10月12日 當日活動</p><ul class="my-list clearfix">${card}</ul></div>`;
  const parsed = parseNmmbaProgrammes(html,'2026-10-12');
  assert.equal(parsed.length,1);
  assert.deepEqual(parsed[0].times.map((time) => time.localTime),['10:00','13:00']);
  assert.equal(parsed[0].observedOn,'2026-10-12');
  assert.throws(() => parseNmmbaProgrammes(html,'2026-10-13'), /日期.*不符/);
  assert.throws(() => parseNmmbaProgrammes(html.replace('每日2場','每日3場'),'2026-10-12'), /場次數.*不符/);
});
