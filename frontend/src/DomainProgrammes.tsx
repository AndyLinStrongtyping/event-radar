import { useEffect, useState } from 'react';

type Session = { startsAt: string; hall: string | null; status: string };
type DailyTime = { localTime: string; durationMinutes: number | null; venue: string | null };
type Programme = { id: string; title: string; venue: string | null; sourceUrl: string;
  priceNote: string | null; sourceCheckedAt: string; observedOn: string | null;
  sessions: Session[] | null; dailySchedule: DailyTime[] | null };
type Response = { items: Programme[]; total: number };

const marineSource = 'https://www.nmmba.gov.tw/ActiveShow_D_Cus.aspx?n=33D045D1594ED637&sms=00C15C8CDECA96C3';
const nttSource = 'https://www.npac-ntt.org/program/events?place=1';
const seaLayers = [
  { title: '入海', english: 'DESCENT 01', note: '光線還在水面閃動，先打開今日的第一批觀察紀錄。' },
  { title: '暮光', english: 'DESCENT 02', note: '繼續往下，沿著時刻與地點尋找下一條線索。' },
  { title: '深藍', english: 'DESCENT 03', note: '抵達旅程底部，別忘了上岸前再向館方確認。' },
] as const;

const dateTime = (value: string) => new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));
const todayTaipei = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function useProgrammes(path: string) {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(path, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('無法載入'); return response.json(); })
      .then((body: Response) => setData(body))
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [path]);
  return { data, error };
}

function Performances() {
  const { data, error } = useProgrammes('/performances');
  return <section className="domain-section" id="performances" aria-labelledby="performances-title">
    <span id="expeditions" aria-hidden="true"/>
    <div className="section-kicker"><span>06</span> PERFORMANCE FIELD NOTES</div>
    <div className="intro-heading"><h2 id="performances-title">舞臺上的故事，<em>從場次開始。</em></h2>
      <p>同一節目可能演出不只一次。從臺中國家歌劇院的場次與廳，找到想看的時間。</p></div>
    <p className="domain-caveat">這裡只列出資料庫中尚未開始、且未標為待核對的場次，按時間先後排列；不是即時或完整節目表。列有場次不代表仍有票；購票、取消與改期請以<a href={nttSource} target="_blank" rel="noopener noreferrer">歌劇院官方節目頁 ↗</a>為準。</p>
    {error ? <p className="domain-message">節目暫時無法載入，請查看館方網站。</p>
      : !data ? <p className="domain-message" role="status">正在翻閱演出檔案…</p>
      : data.total === 0 ? <p className="domain-message">目前沒有可核對的未來場次，請查看館方節目頁。</p>
      : <div className="domain-grid">{data.items.map((item) => <article className="domain-card" key={item.id}>
        <span>PERFORMANCE / 台中</span><h3>{item.title}</h3>
        {item.sessions?.length ? <ul>{item.sessions.map((session) => <li key={session.startsAt}>
          <b>{dateTime(session.startsAt)}</b><small>{session.hall ? ` · ${session.hall}` : ''} · {session.status === 'sold_out' ? '資料標為售罄' : '館方列有場次'}</small>
        </li>)}</ul> : null}
        {item.priceNote && <p>{item.priceNote}</p>}
        <small>資料核對：{dateTime(item.sourceCheckedAt)}</small>
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看館方節目詳情 ↗</a>
      </article>)}</div>}
  </section>;
}

function MarineCard({ item, number }: { item: Programme; number: number }) {
  return <article className="marine-card">
    <div className="marine-card-top"><span>OBSERVATION / {String(number).padStart(2, '0')}</span><span aria-hidden="true">✧</span></div>
    <h4>{item.title}</h4>
    {item.venue && <p className="marine-venue">地點｜{item.venue}</p>}
    {item.dailySchedule?.length ? <div className="marine-times" aria-label="官網當日列出的時段">
      {item.dailySchedule.map((entry) => <div key={entry.localTime}>
        <strong>{entry.localTime}</strong><small>{entry.durationMinutes ? `約 ${entry.durationMinutes} 分鐘` : '時長請查館方'}</small>
      </div>)}
    </div> : null}
    {item.priceNote && <p className="marine-price">{item.priceNote}</p>}
    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">核對館方節目表 <span aria-hidden="true">↗</span></a>
  </article>;
}

function DeepSeaExpedition() {
  const { data, error } = useProgrammes('/marine-programmes');
  const [activeLayer, setActiveLayer] = useState(0);
  useEffect(() => {
    if (!data?.items.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActiveLayer(Number((entry.target as HTMLElement).dataset.layer));
      }
    }, { rootMargin: '-35% 0px -45% 0px' });
    document.querySelectorAll<HTMLElement>('.sea-layer[data-layer]').forEach((layer) => observer.observe(layer));
    return () => observer.disconnect();
  }, [data]);

  const items = data?.items ?? [];
  const chunkSize = Math.max(1, Math.ceil(items.length / seaLayers.length));
  const observedOn = items[0]?.observedOn;
  const isToday = observedOn === todayTaipei();
  return <section className="deep-sea-section" id="deep-sea" aria-labelledby="deep-sea-title">
    <div className="sea-shore" aria-hidden="true">
      <svg className="sea-shore-shape" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <path className="sea-shore-sand" d="M0 0H1440V147C1240 130 1120 170 950 160C770 150 620 111 451 153C273 197 146 145 0 167Z"/>
        <path className="sea-shore-foam" d="M0 191C160 169 280 211 451 177C613 144 784 179 948 184C1132 190 1284 165 1440 180"/>
        <path className="sea-shore-foam sea-shore-foam-soft" d="M0 218C166 196 290 229 461 201C627 174 792 205 958 209C1129 214 1291 188 1440 208"/>
      </svg>
      <div className="sea-shore-copy"><span>FROM LAND TO SEA / 07</span><strong>從陸地，向海裡走。</strong></div>
    </div>
    <div className="sea-light" aria-hidden="true"/><div className="sea-bubbles" aria-hidden="true"/>
    <div className="sea-intro"><div className="sea-intro-inner">
      <div className="section-kicker"><span>07</span> DEEP SEA EXPEDITION</div>
      <p className="sea-coordinate">NMMBA / PINGTUNG / TAIWAN</p>
      <h2 id="deep-sea-title">深海<em>探勘</em></h2>
      <p className="sea-lede">從水面慢慢下潛，打開國立海洋生物博物館的節目觀察紀錄。沿著時刻尋找今天想看的海洋故事。</p>
      <a className="sea-dive-link" href="#sea-layer-1">向下探索 <span aria-hidden="true">↓</span></a>
      <p className="sea-disclaimer">這是視覺化的下潛旅程；分層不代表展館樓層或生物棲息深度。</p>
    </div><div className="sea-horizon" aria-hidden="true"><span/><span/><span/></div></div>
    <div className="sea-body">
      <aside className="sea-depth-guide" aria-label="下潛章節">{seaLayers.map((layer, index) =>
        <a key={layer.english} href={`#sea-layer-${index + 1}`} aria-current={activeLayer === index ? 'step' : undefined}>
          <span className="sea-depth-dot" aria-hidden="true"/><span>{layer.title}</span>
        </a>)}</aside>
      <div className="sea-journey">
        <div className={`sea-freshness${isToday ? '' : ' sea-freshness-old'}`}>
          <span>資料觀察</span><strong>{observedOn ? `${observedOn} 官網當日節目` : '尚無當日節目資料'}</strong>
          <p>{isToday ? '這是官網今日列出的時段；場次仍可能臨時調整。' : '這份紀錄不是今天的節目保證。出發前請先查看館方當日頁面。'} 特殊開館與休館請另外核對<a href="https://www.nmmba.gov.tw/cp.aspx?n=A6476B49BA86BBD5&s=B3CCAAE6060F5DB7" target="_blank" rel="noopener noreferrer">館方服務資訊 ↗</a></p>
        </div>
        {error ? <p className="sea-message">當日節目資料暫時無法載入，請直接查看<a href={marineSource} target="_blank" rel="noopener noreferrer">海生館官方頁 ↗</a>。</p>
          : !data ? <p className="sea-message" role="status">正在下潛，尋找今日的海洋線索…</p>
          : data.total === 0 ? <p className="sea-message">目前沒有可核對的節目資料，請查看館方當日頁面。</p>
          : seaLayers.map((layer, index) => {
            const layerItems = items.slice(index * chunkSize, (index + 1) * chunkSize);
            if (!layerItems.length) return null;
            return <div className={`sea-layer sea-layer-${index + 1}`} id={`sea-layer-${index + 1}`} data-layer={index} key={layer.english}>
              <div className="sea-layer-heading"><span>{layer.english}</span><h3>{layer.title}</h3><p>{layer.note}</p></div>
              <div className="marine-grid">{layerItems.map((item, itemIndex) =>
                <MarineCard key={item.id} item={item} number={index * chunkSize + itemIndex + 1}/>)}</div>
            </div>;
          })}
        <div className="sea-floor"><span aria-hidden="true">✧</span><p>探勘紀錄到此，真正的海洋故事從現場開始。</p><a href={marineSource} target="_blank" rel="noopener noreferrer">開啟海生館當日活動頁 ↗</a></div>
      </div>
    </div>
  </section>;
}

export function DomainProgrammes() {
  return <><Performances/><DeepSeaExpedition/></>;
}
