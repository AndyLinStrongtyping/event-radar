const form = document.querySelector('#filters');
const results = document.querySelector('#results');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty');
const sampleToggle = document.querySelector('#include-sample');
const citySelect = form.elements.city;
const museumSelect = form.elements.museum;
let availableMuseums = [];
let searchGeneration = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function card(item, index) {
  const title = escapeHtml(item.title);
  const venue = escapeHtml(item.venue || '以館方公告為準');
  const summary = escapeHtml(item.summary || '前往官方頁面查看展覽介紹與參觀資訊。');
  const sourceLabel = item.isSample ? '模擬資料' : item.sourceStatus === 'curated' ? '人工核對'
    : item.sourceStatus === 'official_page' ? '館方頁同步' : '公開資料';
  const seen = item.lastSeenAt ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.lastSeenAt)) : null;
  const url = new URL(item.sourceUrl);
  if (url.protocol !== 'https:') return '';
  return `<article class="card" data-url="${escapeHtml(url.href)}">
    <div class="card-top"><span class="card-number">FILE ${String(index + 1).padStart(3, '0')}</span><span class="badge ${item.isSample ? 'sample' : ''}">${sourceLabel}</span></div>
    <p class="card-museum">${escapeHtml(item.museumName)} · ${escapeHtml(item.city)}</p>
    <h3>${title}</h3><p class="card-summary">${summary}</p>
    <div class="card-meta"><div><strong>展期</strong><span>${escapeHtml(item.startDate)} — ${escapeHtml(item.endDate)}</span></div><div><strong>展區</strong><span>${venue}</span></div>${seen ? `<div><strong>核對</strong><span>${escapeHtml(seen)}</span></div>` : ''}</div>
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
  const generation = ++searchGeneration;
  count.textContent = '搜尋中…';
  const params = new URLSearchParams();
  for (const name of ['q', 'city', 'museum', 'from']) {
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  search();
});
citySelect.addEventListener('change', () => {
  updateMuseumOptions();
  search();
});
museumSelect.addEventListener('change', search);
sampleToggle.addEventListener('change', search);

loadMuseums().then(search).catch((error) => { count.textContent = error.message; });
fetch('/preview-status').then((response) => response.ok ? response.json() : null).then((status) => {
  if (status?.preview) document.querySelector('#preview-notice').hidden = false;
}).catch(() => {});
