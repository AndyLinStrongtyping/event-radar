import assert from 'node:assert/strict';
import test from 'node:test';
import { chimeiDetailMatches, extractChimeiExhibitionLinks, robotsAllowExhibitionPage,
  robotsAllowPath } from '../src/sources/chimei.ts';

test('奇美公開頁只擷取館方個別特展連結', () => {
  const html = `<a href="https://www.chimeimuseum.org/special-exhibition/old/current">特展</a>
    <a href="/special-exhibition/new/upcoming?ref=nav">預告</a>
    <a href="https://www.chimeimuseum.org/special-exhibition">特展入口</a>
    <a href="https://other.example/special-exhibition/fake/item">外站</a>
    <a href="https://www.chimeimuseum.org/event/workshop">工作坊</a>`;
  assert.deepEqual(extractChimeiExhibitionLinks(html), [
    'https://www.chimeimuseum.org/special-exhibition/new/upcoming',
    'https://www.chimeimuseum.org/special-exhibition/old/current',
  ]);
});

test('若 robots 禁止特展頁，檢查停止', () => {
  assert.equal(robotsAllowExhibitionPage('User-agent: *\nDisallow: /admin/\n'), true);
  assert.equal(robotsAllowExhibitionPage('User-agent: *\nDisallow: /exhibition-event\n'), false);
  assert.equal(robotsAllowExhibitionPage('User-agent: *\nDisallow: /\n'), false);
  assert.equal(robotsAllowExhibitionPage('User-agent: EventRadarMonitor\nDisallow: /exhibition-event\n'), false);
  assert.equal(robotsAllowExhibitionPage('User-agent: OtherBot\nUser-agent: *\nDisallow: /exhibition-event\n'), false);
  assert.equal(robotsAllowPath('User-agent: *\nDisallow: /special-exhibition/\n', '/special-exhibition/a/b'), false);
  assert.equal(robotsAllowPath('User-agent: *\nDisallow: /news/\n', '/special-exhibition/a/b'), true);
});

test('已知奇美特展詳情需要同時保留展名與完整展期', () => {
  const title = '大英博物館鉅獻《埃及之王：法老》';
  const valid = `<script>old 2026.01.29 － 2026.12.31</script><h1>${title}</h1><p>2026.01.29 － 2027.01.10</p>`;
  assert.equal(chimeiDetailMatches(valid, title, '2026-01-29', '2027-01-10'), true);
  assert.equal(chimeiDetailMatches(valid, title, '2026-01-29', '2027-02-10'), false);
  assert.equal(chimeiDetailMatches(`<h1>${title}</h1><p>2026.01.29 － 2026.12.31</p>`, title,
    '2026-01-29', '2027-01-10'), false);
  assert.equal(chimeiDetailMatches('<h1>其他展覽</h1><p>2026.01.29 － 2027.01.10</p>', title,
    '2026-01-29', '2027-01-10'), false);
});
