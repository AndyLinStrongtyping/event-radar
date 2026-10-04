const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

const root = join(__dirname, 'web');
const port = Number(process.env.PORT || 4180);
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/guides/chimei.html': ['guides/chimei.html', 'text/html; charset=utf-8'],
  '/guides/nmns.html': ['guides/nmns.html', 'text/html; charset=utf-8'],
  '/guides/ntm.html': ['guides/ntm.html', 'text/html; charset=utf-8'],
  '/guides/nmth.html': ['guides/nmth.html', 'text/html; charset=utf-8'],
  '/guides/npm-south.html': ['guides/npm-south.html', 'text/html; charset=utf-8'],
  '/guides/nstm.html': ['guides/nstm.html', 'text/html; charset=utf-8'],
  '/guides/ntsec.html': ['guides/ntsec.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/transport.js': ['transport.js', 'text/javascript; charset=utf-8'],
  '/assets/hero-ruins.png': ['assets/hero-ruins.png', 'image/png'],
  '/assets/nstm-switchboard.jpg': ['assets/nstm-switchboard.jpg', 'image/jpeg'],
  '/assets/nmns-mummy-commons.jpg': ['assets/nmns-mummy-commons.jpg', 'image/jpeg'],
  '/assets/nmns-dinosaur-user.jpg': ['assets/nmns-dinosaur-user.jpg', 'image/jpeg'],
  '/assets/nmns-amethyst-user.jpg': ['assets/nmns-amethyst-user.jpg', 'image/jpeg'],
  '/assets/nmns-fluorescent-minerals-user.jpg': ['assets/nmns-fluorescent-minerals-user.jpg', 'image/jpeg'],
};
const museums = [
  { id: 'chimei', name: '奇美博物館', city: '臺南市' },
  { id: 'nmns', name: '國立自然科學博物館', city: '臺中市' },
  { id: 'npm-south', name: '國立故宮博物院南部院區', city: '嘉義縣' },
];

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    if (files[url.pathname]) {
      const [name, type] = files[url.pathname];
      response.writeHead(200, { 'content-type': type });
      response.end(await readFile(join(root, name)));
      return;
    }
    response.setHeader('content-type', 'application/json; charset=utf-8');
    if (url.pathname === '/preview-status') {
      response.end(JSON.stringify({ preview: true }));
      return;
    }
    if (url.pathname === '/museums') {
      response.end(JSON.stringify({ items: museums }));
      return;
    }
    if (url.pathname === '/exhibitions') {
      const data = JSON.parse(await readFile(join(root, 'demo.json'), 'utf8'));
      const q = url.searchParams;
      const from = q.get('from') || new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const items = data.filter((item) =>
        (q.get('includeSample') === 'true' || !item.isSample)
        && (!q.get('city') || item.city === q.get('city'))
        && (!q.get('museum') || item.museumId === q.get('museum'))
        && (!q.get('q') || item.title.includes(q.get('q')))
        && item.endDate >= from);
      response.end(JSON.stringify({ items, total: items.length, limit: 20, offset: 0 }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: '找不到路徑' } }));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: { code: 'PREVIEW_ERROR', message: error.message } }));
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Event Radar preview: http://127.0.0.1:${port}/\n`);
});
