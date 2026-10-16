import assert from 'node:assert/strict';

const [address, ...options] = process.argv.slice(2);
if (!address || options.some((option) => !['--allow-local-http', '--expect-noindex'].includes(option))) {
  throw new Error('用法：npm run smoke:deploy -- <HTTPS 網址> [--expect-noindex] [--allow-local-http]');
}
const base = new URL(address);
const localHttp = base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname)
  && options.includes('--allow-local-http');
if (base.protocol !== 'https:' && !localHttp) throw new Error('公開站必須使用 HTTPS');
if (base.pathname !== '/' || base.search || base.hash || base.username || base.password) {
  throw new Error('請提供網站根網址，不能包含路徑、參數或帳密');
}

async function get(path, expectedType) {
  const response = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `${path} 回傳 ${response.status}`);
  assert.match(response.headers.get('content-type') ?? '', expectedType, `${path} 回應格式不符`);
  return response;
}

const health = await (await get('/health', /application\/json/)).json();
assert.deepEqual(health, { status: 'ok', database: 'ok' }, '健康檢查未通過');

const homeResponse = await get('/', /text\/html/);
if (options.includes('--expect-noindex')) {
  assert.match(homeResponse.headers.get('x-robots-tag') ?? '', /noindex/, '預覽站首頁未標示 noindex');
} else if (!localHttp) {
  assert.equal(homeResponse.headers.has('x-robots-tag'), false, '正式站仍有 noindex 標頭');
}
const home = await homeResponse.text();
assert.match(home, /id="root"/, '首頁缺少 React 掛載點');
const script = home.match(/src="(\/react-assets\/[a-zA-Z0-9_-]+\.js)"/)?.[1];
const style = home.match(/href="(\/react-assets\/[a-zA-Z0-9_-]+\.css)"/)?.[1];
assert.ok(script && style, '首頁找不到 React 建置檔');
await get(script, /javascript/);
await get(style, /text\/css/);

const museums = await (await get('/museums', /application\/json/)).json();
assert.ok(Array.isArray(museums.items) && museums.items.length > 0, '館所資料尚未初始化');
const exhibitions = await (await get('/exhibitions?limit=1', /application\/json/)).json();
assert.ok(Array.isArray(exhibitions.items) && Number.isInteger(exhibitions.total), '特展查詢格式不符');
assert.ok(exhibitions.total > 0, '尚未匯入可公開的特展資料');
for (const path of ['/performances?limit=1', '/marine-programmes?limit=1']) {
  const data = await (await get(path, /application\/json/)).json();
  assert.ok(Array.isArray(data.items), `${path} 清單格式不符`);
}
await get('/guides/nmmba.html', /text\/html/);
await get('/assets/fossil-penghu-crocodile-gov.jpg', /image\/jpeg/);

if (options.includes('--expect-noindex')) {
  const robots = await (await get('/robots.txt', /text\/plain/)).text();
  assert.match(robots, /Allow: \/\n/, '預覽站 robots.txt 未允許爬蟲讀取 noindex');
  const sitemap = await fetch(new URL('/sitemap.xml', base), { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(sitemap.status, 404, '預覽站不應提供 sitemap');
} else if (!localHttp) {
  const robots = await (await get('/robots.txt', /text\/plain/)).text();
  assert.match(robots, /Allow: \/\n/, '公開站 robots.txt 未開放');
  const sitemap = await (await get('/sitemap.xml', /application\/xml/)).text();
  assert.ok(sitemap.includes(`${base.origin}/guides/nmmba.html`), '網站地圖缺少館所頁');
}

const target = localHttp ? '本機' : options.includes('--expect-noindex') ? '預覽站' : '公開站';
process.stdout.write(`${target}檢查通過：${base.origin}；館所 ${museums.items.length}、可搜尋特展 ${exhibitions.total} 筆。\n`);
