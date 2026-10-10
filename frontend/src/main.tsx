import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Ticket = { label: string; price: string; note: string; infoUrl: string; purchaseUrl?: string | null; checkedOn: string };
type Museum = {
  id: string; name: string; city: string; homepageUrl: string; sourceStatus: string;
  dataStatus: string; lastSuccessAt: string | null; generalAdmission: Ticket | null;
};
type Exhibition = {
  id: string; title: string; museumId: string; museumName: string; city: string;
  venue: string | null; startDate: string; endDate: string; summary: string | null;
  sourceUrl: string; sourceStatus: string; isSample: boolean; exhibitionStatus: string;
  admissionStatus: string; priceNote: string | null; lastSeenAt: string | null;
  ticketing?: { exhibition?: Ticket | null; generalAdmission?: Ticket | null };
};
type Visit = { status: 'open' | 'closed' | 'unknown'; message: string; sourceUrl: string; newsUrl?: string | null; checkedAt?: string | null };
type Filters = { q: string; city: string; museum: string; status: string; admission: string; asOf: string; includeSample: boolean };

const cities = ['臺北市', '臺中市', '臺南市', '嘉義縣', '高雄市', '屏東縣'];
const statusOptions = [
  { value: 'active', label: '未結束' }, { value: 'ongoing', label: '展出中' },
  { value: 'upcoming', label: '即將開始' }, { value: 'ended', label: '已結束' },
  { value: 'all', label: '全部展覽' },
];
const pageSize = 18;
const guides = [
  { id: 'chimei', city: '臺南', name: '奇美博物館', line: '藝術、樂器與跨越時代的文明線索', tag: '藝術與古文明', image: '/assets/chimei-instrument-hall-commons.jpg', alt: '奇美博物館樂器廳內的弦樂器展櫃' },
  { id: 'nmns', city: '臺中', name: '國立自然科學博物館', line: '從恐龍骨骼走進生命與地球歷史', tag: '自然史', image: '/assets/nmns-dinosaur-user.jpg', alt: '科博館展櫃內的恐龍骨骼展示' },
  { id: 'npm-south', city: '嘉義', name: '故宮南院', line: '亞洲藝術、茶文化與織品的旅程', tag: '亞洲文物' },
  { id: 'npm-north', city: '臺北', name: '故宮北院', line: '沿著玉器、青銅器與陶瓷讀文明', tag: '典藏' },
  { id: 'ntm', city: '臺北', name: '國立臺灣博物館', line: '島嶼的自然與人群故事', tag: '臺灣' },
  { id: 'nmth', city: '臺南', name: '國立臺灣歷史博物館', line: '從最初抵岸到當代生活', tag: '歷史' },
  { id: 'nstm', city: '高雄', name: '國立科學工藝博物館', line: '機械與工業如何改變生活', tag: '科技' },
  { id: 'ntsec', city: '臺北', name: '國立臺灣科學教育館', line: '用實驗和互動探索科學', tag: '科學' },
  { id: 'nmmba', city: '屏東', name: '國立海洋生物博物館', line: '從臺灣水域游向世界海洋', tag: '海洋' },
];

function officialUrl(value: string | null | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}
function formatTaipei(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function sourceMessage(museum: Museum) {
  const last = formatTaipei(museum.lastSuccessAt);
  switch (museum.dataStatus) {
    case 'manual': return last ? `人工核對；最後匯入：${last}。展期變動請查館方。` : '人工核對資料；請查館方最新公告。';
    case 'recent': return `最近 7 天內曾成功匯入（${last}）；館方內容未必每日變動。`;
    case 'stale': return `超過 7 天沒有成功匯入；上次成功：${last}。請查館方原頁。`;
    case 'failed': return `最近一次同步失敗；${last ? `上次成功：${last}。` : '尚無成功匯入紀錄。'}請查館方原頁。`;
    case 'untracked': return `已有匯入資料（${last}），但沒有成功的同步嘗試紀錄；無法確認更新頻率。`;
    case 'snapshot': return '本機展示快照，沒有線上同步；展期請查館方公告。';
    case 'never': return '尚無成功匯入紀錄；請查館方最新公告。';
    default: return '無法核對資料更新狀態；請查館方最新公告。';
  }
}
function sourceLabel(item: Exhibition) {
  if (item.isSample) return '模擬資料';
  if (item.sourceStatus === 'curated') return '人工核對';
  if (item.sourceStatus === 'official_page') return '館方頁同步';
  return '公開資料';
}
function todayTaipei() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function searchParams(filters: Filters, offset = 0) {
  const params = new URLSearchParams();
  for (const name of ['q', 'city', 'museum', 'status', 'admission', 'asOf'] as const) {
    const value = filters[name].trim();
    if (value) params.set(name, value);
  }
  if (filters.includeSample) params.set('includeSample', 'true');
  params.set('limit', String(pageSize));
  if (offset) params.set('offset', String(offset));
  return params;
}

function CompassIcon() {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="1.5"/><circle cx="32" cy="32" r="20" stroke="currentColor" opacity=".4"/><path d="m39 25-5 10-10 5 5-10 10-5Z" fill="currentColor"/><path d="M32 2v8M32 54v8M2 32h8M54 32h8" stroke="currentColor" strokeWidth="1.5"/></svg>;
}

function ExcavationLoader() {
  return <div className="excavation-loader" role="status" aria-live="polite">
    <div className="dig-window" aria-hidden="true"><span className="dig-sun"/><span className="dig-relic">◇</span><span className="dig-brush"/><span className="dig-layer dig-layer-one"/><span className="dig-layer dig-layer-two"/></div>
    <div><strong>正在拂去資料塵土</strong><p>尋找展覽檔案中的新線索…</p></div>
  </div>;
}

function ExhibitionCard({ item, number, museum, expanded, onToggle }: { item: Exhibition; number: number; museum?: Museum; expanded: boolean; onToggle: () => void }) {
  const url = officialUrl(item.sourceUrl);
  const special = item.ticketing?.exhibition;
  const general = item.ticketing?.generalAdmission;
  const admission = special?.price ?? (item.admissionStatus === 'free' ? '免費（以館方公告為準）' : item.priceNote || '尚未核對，請查展覽官方頁');
  const status = { ongoing: '展出中', upcoming: '即將開始', ended: '已結束' }[item.exhibitionStatus as 'ongoing' | 'upcoming' | 'ended'] ?? '展期待核對';
  return <article className={`exhibit-card${expanded ? ' is-open' : ''}${item.isSample ? ' is-sample' : ''}`}>
    <div className="exhibit-card-head"><span>DISCOVERY FILE / {String(number).padStart(3, '0')}</span><span className="stamp">{sourceLabel(item)}</span></div>
    <div className="exhibit-card-body"><p className="exhibit-status"><span className="status-dot"/>{status}{item.admissionStatus === 'free' ? ' · 免費' : ''}</p>
      <h3>{item.title}</h3><p className="exhibit-place">{item.museumName} <span>／</span> {item.city}</p>
      <div className="date-ribbon"><small>展覽日期</small><strong>{item.startDate} — {item.endDate}</strong></div>
      <p className="exhibit-summary">{item.summary || '前往官方頁面查看展覽介紹與參觀資訊。'}</p>
    </div>
    <div className="exhibit-actions"><button type="button" aria-expanded={expanded} onClick={onToggle}>{expanded ? '收起檔案' : '翻開展覽檔案'} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>{url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`前往 ${item.title} 的官方頁面`}>館方原頁 ↗</a>}</div>
    {expanded && <div className="exhibit-details">
      <dl><div><dt>展區</dt><dd>{item.venue || '以館方公告為準'}</dd></div><div><dt>本展票價</dt><dd>{admission}</dd></div>{general && <div><dt>一般入館</dt><dd>{general.price}（{general.label}；不代表本展票價）</dd></div>}{item.lastSeenAt && <div><dt>資料更新</dt><dd>{formatTaipei(item.lastSeenAt)}</dd></div>}</dl>
      {museum && museum.dataStatus !== 'recent' && <p className="source-note">{sourceMessage(museum)}</p>}
      {(special || general) && <><p className="ticket-caveat">票務最後人工核對：{special?.checkedOn || general?.checkedOn}。票種與是否另購特展票，以館方為準。</p><div className="detail-links">
        {special && <><a href={officialUrl(special.infoUrl) || '#tickets'} target="_blank" rel="noopener noreferrer">特展票價 ↗</a>{officialUrl(special.purchaseUrl) && <a href={special.purchaseUrl || ''} target="_blank" rel="noopener noreferrer">特展購票 ↗</a>}</>}
        {general && <><a href={officialUrl(general.infoUrl) || '#tickets'} target="_blank" rel="noopener noreferrer">一般票價 ↗</a>{officialUrl(general.purchaseUrl) && <a href={general.purchaseUrl || ''} target="_blank" rel="noopener noreferrer">一般入館購票 ↗</a>}</>}
      </div></>}
    </div>}
  </article>;
}

function App() {
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [museumError, setMuseumError] = useState('');
  const [filters, setFilters] = useState<Filters>({ q: '', city: '', museum: '', status: 'active', admission: 'all', asOf: '', includeSample: false });
  const [items, setItems] = useState<Exhibition[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const demoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const searchGeneration = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [visitLoading, setVisitLoading] = useState(false);
  const [visitError, setVisitError] = useState(false);
  const [preview, setPreview] = useState(false);
  const [ticketCity, setTicketCity] = useState('');

  useEffect(() => () => { if (demoTimer.current) clearTimeout(demoTimer.current); }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/museums', { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error('博物館清單暫時無法載入');
      return response.json();
    }).then((data: { items: Museum[] }) => {
      setMuseums(data.items);
      const requested = new URLSearchParams(location.search).get('museum');
      const found = data.items.find((entry) => entry.id === requested && entry.sourceStatus !== 'planned');
      if (found) setFilters((current) => ({ ...current, city: found.city, museum: found.id }));
    }).catch((error: Error) => { if (error.name !== 'AbortError') setMuseumError(error.message); });
    fetch('/preview-status').then((response) => response.ok ? response.json() : null).then((data) => setPreview(Boolean(data?.preview))).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const generation = ++searchGeneration.current;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    setLoadingMore(false);
    setSearchError('');
    setLoadMoreError('');
    const delay = filters.q ? 220 : 0;
    timer = setTimeout(async () => {
      try {
        const response = await fetch(`/exhibitions?${searchParams(filters)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('特展資料暫時無法載入');
        const data: { items: Exhibition[]; total: number } = await response.json();
        if (generation !== searchGeneration.current) return;
        setItems(data.items);
        setTotal(data.total);
        setExpandedId(null);
        setLoading(false);
      } catch (error) {
        if (controller.signal.aborted || generation !== searchGeneration.current) return;
        setSearchError(error instanceof Error ? error.message : '特展資料暫時無法載入');
        setLoading(false);
      }
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, refreshKey]);

  async function loadMore() {
    if (loading || loadingMore || items.length >= total) return;
    const generation = searchGeneration.current;
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      const response = await fetch(`/exhibitions?${searchParams(filters, items.length)}`);
      if (!response.ok) throw new Error('後續展覽暫時無法載入');
      const data: { items: Exhibition[]; total: number } = await response.json();
      if (generation !== searchGeneration.current) return;
      setItems((current) => [...current, ...data.items]);
      setTotal(data.total);
    } catch (error) {
      if (generation !== searchGeneration.current) return;
      setLoadMoreError(error instanceof Error ? error.message : '後續展覽暫時無法載入');
    } finally {
      if (generation === searchGeneration.current) setLoadingMore(false);
    }
  }

  function replayDig() {
    if (demoTimer.current) clearTimeout(demoTimer.current);
    setDemoLoading(true);
    demoTimer.current = setTimeout(() => { setDemoLoading(false); demoTimer.current = null; }, 6000);
  }

  useEffect(() => {
    if (!filters.museum) { setVisit(null); setVisitError(false); return; }
    const controller = new AbortController();
    setVisitLoading(true);
    setVisitError(false);
    const date = filters.asOf || todayTaipei();
    fetch(`/visit-status?${new URLSearchParams({ museum: filters.museum, date })}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('開館資訊暫時無法核對'); return response.json(); })
      .then((info: Visit) => { setVisit(info); setVisitLoading(false); })
      .catch((error: Error) => { if (error.name !== 'AbortError') { setVisitError(true); setVisitLoading(false); } });
    return () => controller.abort();
  }, [filters.museum, filters.asOf]);

  const availableMuseums = useMemo(() => museums.filter((museum) => museum.sourceStatus !== 'planned'), [museums]);
  const museumOptions = availableMuseums.filter((museum) => !filters.city || museum.city === filters.city);
  const selectedMuseum = availableMuseums.find((museum) => museum.id === filters.museum);
  const ticketMuseums = museums.filter((museum) => museum.generalAdmission && (!ticketCity || museum.city === ticketCity));
  const ticketCities = [...new Set(museums.filter((museum) => museum.generalAdmission).map((museum) => museum.city))];
  const updateFilter = <K extends keyof Filters>(name: K, value: Filters[K]) => setFilters((current) => ({ ...current, [name]: value }));

  return <>
    <a className="skip-link" href="#results">跳到展覽結果</a>
    <header className="site-header"><div className="header-inner"><a className="brand" href="/" aria-label="Event Radar 首頁"><span className="brand-glyph">✧</span><span>EVENT <b>RADAR</b><small>博物館探索檔案</small></span></a><nav aria-label="主要導覽"><a href="#explore-title">探索特展</a><a href="#guides">博物館圖鑑</a><a href="#tickets">票務索引</a></nav><span className="header-edition">FIELD JOURNAL <i>01 / TAIWAN</i></span></div></header>
    <main>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-grain" aria-hidden="true"/><div className="hero-inner"><div className="hero-copy-block"><p className="eyebrow"><span className="eyebrow-line"/> A LIVING ARCHIVE OF DISCOVERY</p><h1 id="hero-title">翻開地層，<br/>遇見<span>未知的故事。</span></h1><p className="hero-lede">從古埃及的文字、遠古生命的化石，到藏在博物館裡的當期特展。跟著官方資料留下的線索，選一站，開始你的探索。</p><div className="hero-actions"><a className="primary-cta" href="#explore-title">開始發掘展覽 <span aria-hidden="true">↗</span></a><a className="text-cta" href="#guides">先認識博物館 <span aria-hidden="true">→</span></a></div><div className="hero-coordinate">25° N — 22° N <span>／</span> NINE MUSEUMS, MANY STORIES</div></div><div className="hero-art" aria-label="古文明展品的考古檔案視覺"><span className="art-corner art-corner-top"/><img src="/assets/egypt-writing-user.jpg" alt="博物館內的羅塞塔石碑複製品展示，表面刻有古代文字"/><span className="art-corner art-corner-bottom"/><div className="artifact-tag"><span>FIELD NOTE / 001</span><strong>文字留下的線索</strong><small>古文明 · 自攝展品照片</small></div><div className="art-seal" aria-hidden="true"><CompassIcon/></div></div></div><div className="hero-bottom"><span>SCROLL TO DISCOVER</span><span className="hero-bottom-line"/><span>考古不是回到過去，而是重新看見現在。</span></div></section>

      <section className="discover-intro" aria-labelledby="discover-title"><div className="section-kicker"><span>01</span> START WITH A CLUE</div><div className="intro-heading"><h2 id="discover-title">每座博物館，<em>都是一處新現場。</em></h2><p>先從兩條熟悉的線索出發，再走進你自己的探索路線。照片是展品現場紀錄；詳細展覽與開放資訊請以館方為準。</p></div><div className="story-grid"><a className="story-card" href="/?museum=chimei#explore-title"><div className="story-image"><img src="/assets/egypt-writing-user.jpg" alt="古埃及文字展示品" loading="lazy"/></div><div className="story-content"><span>CLUE 01 / ANCIENT WORLDS</span><h3>文字與古文明</h3><p>自攝古文明展品作為探索主題示意；點入查看奇美相關展覽，照片並非奇美館藏介紹。</p><b>探索奇美相關展覽 ↗</b></div></a><a className="story-card" href="/guides/nmns.html"><div className="story-image"><img src="/assets/nmns-dinosaur-user.jpg" alt="科博館展櫃內的恐龍骨骼" loading="lazy"/></div><div className="story-content"><span>CLUE 02 / DEEP TIME</span><h3>化石與遠古生命</h3><p>在骨骼與地層之間，看見地球漫長的生命史。</p><b>走進科博館圖鑑 ↗</b></div></a></div></section>

      <section className="explore-section" aria-labelledby="explore-title"><div className="section-kicker light"><span>02</span> THE EXHIBITION ARCHIVE</div><div className="explore-heading"><div><h2 id="explore-title">特展發掘站</h2><p>設定目的地與時間，翻開最新的展覽檔案。</p></div><div className="explore-emblem" aria-hidden="true"><CompassIcon/></div></div>
        {preview && <p className="preview-note" role="status">本機展示快照：展覽資料並非即時同步，模擬資料需主動勾選才顯示。</p>}
        <div className="search-panel" role="search" aria-label="搜尋特展"><div className="search-top"><label className="search-keyword"><span>01 / 尋找線索</span><input type="search" value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} placeholder="輸入展名、主題或關鍵字" autoComplete="off"/></label><label><span>02 / 選擇城市</span><select value={filters.city} onChange={(event) => { setFilters((current) => ({ ...current, city: event.target.value, museum: '' })); }}><option value="">全臺灣</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label><label><span>03 / 指定館所</span><select value={filters.museum} onChange={(event) => updateFilter('museum', event.target.value)}><option value="">{filters.city ? '該地區所有博物館' : '所有博物館'}</option>{museumOptions.map((museum) => <option key={museum.id} value={museum.id}>{museum.name}</option>)}</select></label></div><div className="search-bottom"><div className="status-tabs" role="group" aria-label="展覽狀態">{statusOptions.map((option) => <button key={option.value} type="button" className={filters.status === option.value ? 'active' : ''} aria-pressed={filters.status === option.value} onClick={() => updateFilter('status', option.value)}>{option.label}</button>)}</div><button type="button" className="refresh-button" onClick={() => setRefreshKey((value) => value + 1)}>重新查詢 ↗</button></div><div className="advanced-filters"><label>入場資訊<select value={filters.admission} onChange={(event) => updateFilter('admission', event.target.value)}><option value="all">不限票價</option><option value="free">明確標示免費</option></select></label><label>查詢基準日<input type="date" value={filters.asOf} onChange={(event) => updateFilter('asOf', event.target.value)} aria-label="以此日期判斷展覽狀態"/></label><label className="sample-check"><input type="checkbox" checked={filters.includeSample} onChange={(event) => updateFilter('includeSample', event.target.checked)}/> 顯示測試資料</label></div></div>
        <p className="search-note">狀態依展期與查詢基準日計算；「免費」只收錄明確標示免費的資料。未提供票價不推斷為免費。</p>
        <div className="status-panels"><aside className={`status-panel${selectedMuseum && selectedMuseum.dataStatus !== 'recent' ? ' caution' : ''}`} aria-live="polite"><span>資料來源狀態</span><strong>{selectedMuseum ? selectedMuseum.name : '各館資料更新方式不同'}</strong><p>{selectedMuseum ? sourceMessage(selectedMuseum) : '選擇一間博物館，查看最後成功匯入與同步狀態。參觀前請開啟展覽的官方連結核對。'}</p>{officialUrl(selectedMuseum?.homepageUrl) && <a href={selectedMuseum!.homepageUrl} target="_blank" rel="noopener noreferrer">查看館方網站 ↗</a>}</aside><aside className={`status-panel visit ${visit?.status || ''}`} aria-live="polite"><span>出發前確認</span><strong>{visitLoading ? '正在核對開館資訊' : visitError ? '開館資訊暫時無法核對' : !selectedMuseum ? '平常開放時間已整理' : visit?.status === 'closed' ? '休館提醒' : visit?.status === 'open' ? '館方行事曆顯示開館' : '請向館方確認'}</strong><p>{visitLoading ? '正在讀取館方資料…' : visitError ? '請查看館方最新公告後再出發。' : visit?.message || '各館的平常開館時間放在博物館介紹；國定假日、節慶與臨時異動請以館方公告為準。'}</p>{selectedMuseum && <div className="status-links"><a href={`/guides/${encodeURIComponent(selectedMuseum.id)}.html`}>查看平常開館時間 ↗</a>{officialUrl(visit?.sourceUrl) && <a href={visit!.sourceUrl} target="_blank" rel="noopener noreferrer">館方開放資訊 ↗</a>}{officialUrl(visit?.newsUrl) && <a href={visit!.newsUrl || ''} target="_blank" rel="noopener noreferrer">館方最新消息 ↗</a>}</div>}</aside></div>
        <div className="results-heading" id="results">
          <div><span>UNEARTHED RECORDS</span><h3>{loading || demoLoading ? '正在發掘檔案…' : searchError || museumError || `找到 ${total} 場特展`}</h3></div>
          <div className="results-tools"><p>每筆展覽皆附館方或資料來源連結</p><button type="button" onClick={replayDig} disabled={demoLoading} aria-label="觀看文物發掘動畫">{demoLoading ? '發掘中…' : '觀看發掘動畫 ↻'}</button></div>
        </div>
        <div className="results-region" aria-busy={loading || demoLoading}>
          {loading || demoLoading ? <ExcavationLoader/> : searchError || museumError ? <div className="empty-state"><strong>線索暫時中斷</strong><p>{searchError || museumError}</p><button type="button" onClick={() => setRefreshKey((value) => value + 1)}>再試一次</button></div> : items.length ? <>
            <div className="exhibit-grid">{items.map((item, index) => <ExhibitionCard key={item.id} item={item} number={index + 1} museum={availableMuseums.find((entry) => entry.id === item.museumId)} expanded={expandedId === item.id} onToggle={() => setExpandedId((id) => id === item.id ? null : item.id)}/>)}</div>
            <div className="more-results"><span>目前顯示 {items.length} / {total} 筆展覽</span>{items.length < total && <button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? '正在繼續發掘…' : '載入更多展覽 ↓'}</button>}{loadMoreError && <p role="alert">{loadMoreError}，請再試一次。</p>}</div>
          </> : <div className="empty-state"><div className="empty-symbol" aria-hidden="true">⌕</div><strong>這片地層暫無線索</strong><p>試試其他城市、展覽狀態或入場條件。</p><button type="button" onClick={() => setFilters({ q: '', city: '', museum: '', status: 'active', admission: 'all', asOf: '', includeSample: false })}>清除篩選</button></div>}
        </div>
      </section>

      <section className="guides-section" id="guides" aria-labelledby="guides-title"><div className="section-kicker"><span>03</span> MUSEUM FIELD NOTES</div><div className="intro-heading"><h2 id="guides-title">館所圖鑑，<em>從這裡展開。</em></h2><p>九座館所的特色、常設展線索與平常開館時間。例行時間為人工核對，特殊日子出發前仍須看館方公告。</p></div><div className="guide-grid">{guides.map((guide, index) => <a className={`guide-card ${index < 2 ? 'featured' : ''}`} key={guide.id} href={`/guides/${guide.id}.html`}>{guide.image && <div className="guide-image"><img src={guide.image} alt={guide.alt || ''} loading="lazy"/></div>}<div className="guide-card-copy"><span>FIELD GUIDE {String(index + 1).padStart(2, '0')} / {guide.city}</span><h3>{guide.name}</h3><p>{guide.line}</p><div><b>{guide.tag}</b><strong aria-hidden="true">↗</strong></div></div></a>)}</div></section>

      <section className="tickets-section" id="tickets" aria-labelledby="tickets-title"><div className="section-kicker"><span>04</span> PLAN YOUR VISIT</div><div className="intro-heading"><h2 id="tickets-title">出發前，<em>先核對票務。</em></h2><p>以下為一般入館或常設展票價，不等於每檔特展門票。優惠、預約與售票狀態以館方頁面為準。</p></div><div className="ticket-city-tabs" role="group" aria-label="依城市查看票務"><button type="button" className={!ticketCity ? 'active' : ''} aria-pressed={!ticketCity} onClick={() => setTicketCity('')}>全部館所</button>{ticketCities.map((city) => <button type="button" key={city} className={ticketCity === city ? 'active' : ''} aria-pressed={ticketCity === city} onClick={() => setTicketCity(city)}>{city}</button>)}</div><div className="ticket-grid">{ticketMuseums.map((museum) => { const ticket = museum.generalAdmission!; return <article className="ticket-card" key={museum.id}><span>{museum.city} / {ticket.label}</span><h3>{museum.name}</h3><strong>{ticket.price}</strong><p>{ticket.note}</p><div className="ticket-card-links"><a href={officialUrl(ticket.infoUrl) || '#tickets'} target="_blank" rel="noopener noreferrer">官方票價 ↗</a>{officialUrl(ticket.purchaseUrl) ? <a href={ticket.purchaseUrl || ''} target="_blank" rel="noopener noreferrer">購票入口 ↗</a> : <small>依館方說明購票</small>}</div><small>最後人工核對：{ticket.checkedOn}</small></article>; })}</div></section>
    </main><footer className="site-footer"><div><span className="footer-brand">✧ EVENT RADAR</span><p>沿著真實資料，繼續探索未知。</p></div><p>資訊取自各博物館與政府公開資料；展期、票價、休館與入場規定，以館方公告為準。</p><a href="#hero-title">回到頂端 ↑</a></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<App/>);
