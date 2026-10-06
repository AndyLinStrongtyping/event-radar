const form = document.querySelector('#filters');
const results = document.querySelector('#results');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty');
const sampleToggle = document.querySelector('#include-sample');
const citySelect = form.elements.city;
const museumSelect = form.elements.museum;
const visitPanel = document.querySelector('#visit-status');
let availableMuseums = [];
let searchGeneration = 0;
let visitGeneration = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function card(item, index) {
  const title = escapeHtml(item.title);
  const venue = escapeHtml(item.venue || '以館方公告為準');
  const summary = escapeHtml(item.summary || '前往官方頁面查看展覽介紹與參觀資訊。');
  const sourceLabel = item.isSample ? '模擬資料' : item.sourceStatus === 'curated' ? '人工核對'
    : item.sourceStatus === 'official_page' ? '館方頁同步' : '公開資料';
  const statusLabel = { ongoing: '展出中', upcoming: '即將開始', ended: '已結束' }[item.exhibitionStatus] || '展期待核對';
  const admissionLabel = item.admissionStatus === 'free' ? '免費（以館方公告為準）'
    : item.priceNote ? escapeHtml(item.priceNote) : '尚未提供，請查館方';
  const seen = item.lastSeenAt ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.lastSeenAt)) : null;
  const url = new URL(item.sourceUrl);
  if (url.protocol !== 'https:') return '';
  return `<article class="card" data-url="${escapeHtml(url.href)}">
    <div class="card-top"><span class="card-number">FILE ${String(index + 1).padStart(3, '0')}</span><span class="badge ${item.isSample ? 'sample' : ''}">${sourceLabel}</span></div>
    <p class="card-state">${statusLabel}${item.admissionStatus === 'free' ? ' · 免費' : ''}</p>
    <p class="card-museum">${escapeHtml(item.museumName)} · ${escapeHtml(item.city)}</p>
    <h3>${title}</h3><p class="card-summary">${summary}</p>
    <div class="card-meta"><div><strong>展期</strong><span>${escapeHtml(item.startDate)} — ${escapeHtml(item.endDate)}</span></div><div><strong>展區</strong><span>${venue}</span></div><div><strong>入場</strong><span>${admissionLabel}</span></div>${seen ? `<div><strong>核對</strong><span>${escapeHtml(seen)}</span></div>` : ''}</div>
    <a class="card-link" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer" aria-label="前往 ${title} 的官方頁面">查看官方資訊 <span aria-hidden="true">↗</span></a>
  </article>`;
}

function updateMuseumOptions() {
  const selected = museumSelect.value;
  const city = citySelect.value;
  const placeholder = new Option(city ? '該地區所有博物館' : '所有博物館', '');
  const options = availableMuseums.filter((museum) => !city || museum.city === city)
    .map((museum) => new Option(museum.name, museum.id));
  museumSelect.replaceChildren(placeholder, ...options);
  museumSelect.value = options.some((option) => option.value === selected) ? selected : '';
}

async function loadMuseums() {
  const response = await fetch('/museums');
  if (!response.ok) throw new Error('館所清單無法載入');
  const { items } = await response.json();
  availableMuseums = items.filter((museum) => museum.sourceStatus !== 'planned');
  const requestedMuseum = new URLSearchParams(location.search).get('museum');
  const requested = availableMuseums.find((museum) => museum.id === requestedMuseum);
  if (requested && [...citySelect.options].some((option) => option.value === requested.city)) {
    citySelect.value = requested.city;
  }
  updateMuseumOptions();
  if (requested) museumSelect.value = requested.id;
}

async function search() {
  updateVisitStatus();
  const generation = ++searchGeneration;
  count.textContent = '搜尋中…';
  const params = new URLSearchParams();
  for (const name of ['q', 'city', 'museum', 'status', 'admission', 'asOf']) {
    const value = form.elements[name].value.trim();
    if (value) params.set(name, value);
  }
  if (sampleToggle.checked) params.set('includeSample', 'true');
  try {
    const response = await fetch(`/exhibitions?${params}`);
    if (!response.ok) throw new Error('特展資料暫時無法載入');
    const data = await response.json();
    if (generation !== searchGeneration) return;
    results.innerHTML = data.items.map(card).join('');
    count.textContent = `找到 ${data.total} 場特展`;
    empty.hidden = data.total !== 0;
  } catch (error) {
    if (generation !== searchGeneration) return;
    count.textContent = error.message;
    results.replaceChildren();
    empty.hidden = true;
  }
}

async function updateVisitStatus() {
  const generation = ++visitGeneration;
  const museum = museumSelect.value;
  if (!museum) {
    visitPanel.innerHTML = '<strong>出發前核對開館資訊</strong><p>選擇博物館與參觀日期後，可查看休館提醒及館方公告入口。</p>';
    return;
  }
  const date = form.elements.asOf.value || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  visitPanel.innerHTML = '<strong>開館資訊核對中…</strong>';
  try {
    const response = await fetch(`/visit-status?${new URLSearchParams({ museum, date })}`);
    if (!response.ok) throw new Error('無法取得開館資訊');
    const info = await response.json();
    if (generation !== visitGeneration) return;
    const source = new URL(info.sourceUrl);
    if (source.protocol !== 'https:') throw new Error('來源網址無效');
    const news = info.newsUrl ? new URL(info.newsUrl) : null;
    visitPanel.className = `visit-status visit-${info.status}`;
    visitPanel.innerHTML = `<strong>${info.status === 'closed' ? '休館提醒' : info.status === 'open' ? '館方行事曆顯示開館' : '請向館方確認'}</strong>
      <p>${escapeHtml(info.message)}</p><div class="visit-links"><a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">查看館方開放資訊 ↗</a>${news?.protocol === 'https:' ? `<a href="${escapeHtml(news.href)}" target="_blank" rel="noopener noreferrer">查看奇美館方訊息 ↗</a>` : ''}</div>
      ${info.checkedAt ? `<small>API 核對時間：${escapeHtml(new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(info.checkedAt)))}</small>` : ''}`;
  } catch {
    if (generation === visitGeneration) visitPanel.innerHTML = '<strong>開館資訊暫時無法核對</strong><p>請查看館方最新公告後再出發。</p>';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  search();
});
citySelect.addEventListener('change', () => {
  updateMuseumOptions();
  search();
});
museumSelect.addEventListener('change', search);
form.elements.status.addEventListener('change', search);
form.elements.admission.addEventListener('change', search);
form.elements.asOf.addEventListener('change', search);
sampleToggle.addEventListener('change', search);

loadMuseums().then(search).catch((error) => { count.textContent = error.message; });
fetch('/preview-status').then((response) => response.ok ? response.json() : null).then((status) => {
  if (status?.preview) document.querySelector('#preview-notice').hidden = false;
}).catch(() => {});
