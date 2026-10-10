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
  '/guides/npm-north.html': ['guides/npm-north.html', 'text/html; charset=utf-8'],
  '/guides/nmmba.html': ['guides/nmmba.html', 'text/html; charset=utf-8'],
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
  '/assets/chimei-instrument-hall-commons.jpg': ['assets/chimei-instrument-hall-commons.jpg', 'image/jpeg'],
  '/assets/npm-south-building-commons.jpg': ['assets/npm-south-building-commons.jpg', 'image/jpeg'],
  '/assets/npm-north-building-commons.jpg': ['assets/npm-north-building-commons.jpg', 'image/jpeg'],
  '/assets/nmmba-kelp-commons.jpg': ['assets/nmmba-kelp-commons.jpg', 'image/jpeg'],
  '/assets/npm-teacup-commons.jpg': ['assets/npm-teacup-commons.jpg', 'image/jpeg'],
};
const museums = [
  { id: 'chimei', name: '奇美博物館', city: '臺南市', homepageUrl: 'https://www.chimeimuseum.org/', sourceStatus: 'curated' },
  { id: 'nmns', name: '國立自然科學博物館', city: '臺中市', homepageUrl: 'https://www.nmns.edu.tw/', sourceStatus: 'open_data' },
  { id: 'npm-south', name: '國立故宮博物院南部院區', city: '嘉義縣', homepageUrl: 'https://south.npm.gov.tw/', sourceStatus: 'official_page' },
  { id: 'npm-north', name: '國立故宮博物院北部院區', city: '臺北市', homepageUrl: 'https://www.npm.gov.tw/', sourceStatus: 'open_data' },
  { id: 'nmmba', name: '國立海洋生物博物館', city: '屏東縣', homepageUrl: 'https://www.nmmba.gov.tw/', sourceStatus: 'open_data' },
  { id: 'ntm', name: '國立臺灣博物館', city: '臺北市', homepageUrl: 'https://www.ntm.gov.tw/', sourceStatus: 'planned' },
  { id: 'nmth', name: '國立臺灣歷史博物館', city: '臺南市', homepageUrl: 'https://www.nmth.gov.tw/', sourceStatus: 'planned' },
  { id: 'nstm', name: '國立科學工藝博物館', city: '高雄市', homepageUrl: 'https://www.nstm.gov.tw/', sourceStatus: 'planned' },
  { id: 'ntsec', name: '國立臺灣科學教育館', city: '臺北市', homepageUrl: 'https://www.ntsec.gov.tw/', sourceStatus: 'planned' },
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
      const { museumTickets } = await import('./src/ticketing.ts');
      response.end(JSON.stringify({ items: museums.map((museum) => ({ ...museum,
        lastSuccessAt: null, lastAttemptStatus: null, lastAttemptAt: null, dataStatus: 'snapshot',
        generalAdmission: museumTickets[museum.id] ?? null,
      })) }));
      return;
    }
    if (url.pathname === '/visit-status') {
      const { visitStatus } = await import('./src/visit-status.ts');
      const museum = url.searchParams.get('museum') || '';
      const date = url.searchParams.get('date') || '';
      try { response.end(JSON.stringify(await visitStatus(museum, date))); }
      catch {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: { code: 'BAD_REQUEST', message: '館所或日期無效' } }));
      }
      return;
    }
    if (url.pathname === '/exhibitions') {
      const { ticketingForExhibition } = await import('./src/ticketing.ts');
      const data = JSON.parse(await readFile(join(root, 'demo.json'), 'utf8'));
      const q = url.searchParams;
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const asOf = q.get('asOf') || today;
      const status = q.get('status') || 'active';
      const admission = q.get('admission') || 'all';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(`${asOf}T00:00:00Z`))
        || new Date(`${asOf}T00:00:00Z`).toISOString().slice(0, 10) !== asOf
        || !['active', 'ongoing', 'upcoming', 'ended', 'all'].includes(status)
        || !['all', 'free'].includes(admission)) {
        response.statusCode = 400;
        response.end(JSON.stringify({ error: { code: 'BAD_REQUEST', message: '篩選參數無效' } }));
        return;
      }
      const free = (item) => ['免費', '免費入場', '免門票'].includes(item.priceNote);
      const items = data.filter((item) =>
        (q.get('includeSample') === 'true' || !item.isSample)
        && (!q.get('city') || item.city === q.get('city'))
        && (!q.get('museum') || item.museumId === q.get('museum'))
        && (!q.get('q') || item.title.includes(q.get('q')))
        && (!q.get('from') || item.endDate >= q.get('from'))
        && (!q.get('to') || item.startDate <= q.get('to'))
        && (status === 'all' || status === 'active' && item.endDate >= asOf
          || status === 'ongoing' && item.startDate <= asOf && item.endDate >= asOf
          || status === 'upcoming' && item.startDate > asOf
          || status === 'ended' && item.endDate < asOf)
        && (admission === 'all' || free(item)))
        .map((item) => ({ ...item,
          ticketing: ticketingForExhibition(item),
          exhibitionStatus: item.endDate < asOf ? 'ended' : item.startDate > asOf ? 'upcoming' : 'ongoing',
          admissionStatus: free(item) ? 'free' : 'unknown',
        }));
      items.sort((a, b) => status === 'ended' ? b.endDate.localeCompare(a.endDate)
        : status === 'ongoing' ? a.endDate.localeCompare(b.endDate)
        : status === 'all' ? b.startDate.localeCompare(a.startDate)
        : a.startDate.localeCompare(b.startDate));
      response.end(JSON.stringify({ items: items.slice(0, 20), total: items.length, limit: 20, offset: 0 }));
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
