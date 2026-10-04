const form = document.querySelector('#filters');
const results = document.querySelector('#results');
const count = document.querySelector('#result-count');
const empty = document.querySelector('#empty');
const sampleToggle = document.querySelector('#include-sample');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function card(item, index) {
  const title = escapeHtml(item.title);
  const venue = escapeHtml(item.venue || '以館方公告為準');
  const summary = escapeHtml(item.summary || '前往官方頁面查看展覽介紹與參觀資訊。');
  const url = new URL(item.sourceUrl);
  if (url.protocol !== 'https:') return '';
  return `<article class="card" data-url="${escapeHtml(url.href)}">
    <div class="card-top"><span class="card-number">FILE ${String(index + 1).padStart(3, '0')}</span><span class="badge ${item.isSample ? 'sample' : ''}">${item.isSample ? '模擬資料' : '官方來源'}</span></div>
    <p class="card-museum">${escapeHtml(item.museumName)} · ${escapeHtml(item.city)}</p>
    <h3>${title}</h3><p class="card-summary">${summary}</p>
    <div class="card-meta"><div><strong>展期</strong><span>${escapeHtml(item.startDate)} — ${escapeHtml(item.endDate)}</span></div><div><strong>展區</strong><span>${venue}</span></div></div>
    <a class="card-link" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer" aria-label="前往 ${title} 的官方頁面">查看官方資訊 <span aria-hidden="true">↗</span></a>
  </article>`;
}

async function loadMuseums() {
  const response = await fetch('/museums');
  if (!response.ok) throw new Error('館所清單無法載入');
  const { items } = await response.json();
  const select = form.elements.museum;
  for (const museum of items) {
    const option = document.createElement('option');
    option.value = museum.id;
    option.textContent = museum.name;
    select.append(option);
  }
}

async function search() {
  count.textContent = '搜尋中…';
  const params = new URLSearchParams();
  for (const name of ['q', 'city', 'museum', 'from']) {
    const value = form.elements[name].value.trim();
    if (value) params.set(name, value);
  }
  if (sampleToggle.checked) params.set('includeSample', 'true');
  const response = await fetch(`/exhibitions?${params}`);
  if (!response.ok) throw new Error('特展資料暫時無法載入');
  const data = await response.json();
  results.innerHTML = data.items.map(card).join('');
  count.textContent = `找到 ${data.total} 場特展`;
  empty.hidden = data.total !== 0;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  search().catch((error) => { count.textContent = error.message; results.replaceChildren(); });
});
sampleToggle.addEventListener('change', () => {
  search().catch((error) => { count.textContent = error.message; results.replaceChildren(); });
});

Promise.all([loadMuseums(), search()]).catch((error) => { count.textContent = error.message; });
fetch('/preview-status').then((response) => response.ok ? response.json() : null).then((status) => {
  if (status?.preview) document.querySelector('#preview-notice').hidden = false;
}).catch(() => {});
