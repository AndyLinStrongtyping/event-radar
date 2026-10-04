import assert from 'node:assert/strict';
import test from 'node:test';
import { extractChimeiExhibitionLinks, robotsAllowExhibitionPage } from '../src/sources/chimei.ts';

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
});
