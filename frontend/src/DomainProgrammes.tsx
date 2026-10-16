import { useEffect, useState } from 'react';
import { compareMarineObservations } from './marine-observation-diff.ts';

type Session = { sessionKey: string; startsAt: string; hall: string | null;
  status: 'scheduled' | 'sold_out' | 'cancelled' | 'postponed' | 'unknown';
  statusOrigin: 'source' | 'manual'; statusEvidenceUrl: string | null;
  statusReviewedAt: string | null };
type DailyTime = { localTime: string; durationMinutes: number | null; venue: string | null };
type Programme = { id: string; sourceKey: string; title: string; venue: string | null; sourceUrl: string;
  priceNote: string | null; sourceCheckedAt: string; observedOn: string | null;
  sessions: Session[] | null; dailySchedule: DailyTime[] | null };
type Response = { items: Programme[]; total: number };
type SeaExhibition = { id: string; title: string; startDate: string; endDate: string;
  exhibitionStatus: 'ongoing' | 'upcoming' | 'ended'; sourceUrl: string; summary: string | null };
type SeaExhibitionResponse = { items: SeaExhibition[]; total: number };

const marineSource = 'https://www.nmmba.gov.tw/ActiveShow_D_Cus.aspx?n=33D045D1594ED637&sms=00C15C8CDECA96C3';
const nttSource = 'https://www.npac-ntt.org/program/events?place=1';
const churaumiSource = 'https://churaumi.okinawa/en/area/floormap/';
const churaumiCoreAreas = [
  { floor: '3F', title: '珊瑚之海', subtitle: '從陽光開始',
    description: '開放式水槽引入自然光，讓活珊瑚與礁區生物成為下潛旅程的第一站。',
    url: 'https://churaumi.okinawa/en/area/the-coral-reef/coral-sea/' },
  { floor: '2F', title: '黑潮之海', subtitle: '走進大水槽',
    description: '大型水槽呈現黑潮海域，從觀景窗看鯨鯊與蝠魟的游動。活體展示以館方當日資訊為準。',
    url: 'https://churaumi.okinawa/en/area/the-kuroshio/kuroshio/' },
  { floor: '1F', title: '深海', subtitle: '抵達低光海域',
    description: '沿樓層向下，認識水深 300 公尺以上海域的生物與環境。',
    url: 'https://churaumi.okinawa/en/area/the-deep-sea/deep-sea/' },
] as const;
const churaumiProgrammes = [
  { name: '黑潮之海餵食', place: '館內 2F／黑潮之海', times: '魟魚 09:30；鯨鯊 15:00、17:00',
    note: '館方提醒，動物狀況可能使餵食取消。', url: 'https://churaumi.okinawa/en/program/aquarium/kuroshio/' },
  { name: '海豚劇場', place: '海洋博公園／水族館外', times: '10:30、11:30、13:00、15:00、17:00',
    note: '館方列為免費節目；2027/01/04–01/09 因維修暫停。', url: 'https://churaumi.okinawa/en/program/surrounding-area/1459390261/' },
] as const;
const marineSpecies = [
  { name: '臺灣鉤吻鮭', habitat: '臺灣水域館／高山溪流', clue: '從冷冽溪流認識臺灣特有魚類，以及水域環境和生物之間的關係。',
    image: '/assets/species-formosan-salmon-commons.jpg', imageAlt: '臺灣鉤吻鮭在武陵溪流中游動的野外照片',
    imageNote: '物種示意｜武陵野外照片，非館內展示',
    imageSource: 'https://commons.wikimedia.org/wiki/File:Formosan_Landlocked_Salmon_in_Wuling_Farm,_Taichung,_Taiwan.jpg',
    url: 'https://www.nmmba.gov.tw/News_Cus2.aspx?CategorySN=100&n=10CA9F72C981FC4C' },
  { name: '白鯨', habitat: '珊瑚王國館／白鯨池', clue: '留意牠如何上浮換氣；館方另介紹聲學研究、照護與環境豐富化。',
    image: '/assets/species-beluga-commons.jpg', imageAlt: '白鯨在水中游動的照片，攝於加拿大水族館',
    imageNote: '物種示意｜攝於加拿大，非海生館',
    imageSource: 'https://commons.wikimedia.org/wiki/File:Beluga_whale.jpg',
    url: 'https://www.nmmba.gov.tw/News_Cus2.aspx?CategorySN=105&n=10CA9F72C981FC4C' },
  { name: '企鵝', habitat: '世界水域館／極地水域', clue: '觀察不同企鵝在寒冷水域的活動方式；實際展示種類以館方當日資訊為準。',
    image: '/assets/species-nmmba-penguins-commons.jpg', imageAlt: '國立海洋生物博物館過往展場中的企鵝',
    imageNote: '海生館過往展場照片｜非今日展示紀錄',
    imageSource: 'https://commons.wikimedia.org/wiki/File:National_Museum_of_Marine_Biology_and_Aquarium,_Taiwan_02.jpg',
    url: 'https://www.nmmba.gov.tw/cp.aspx?n=c3b73a6100ac6f06&s=6CAFA8D4F7D63697' },
] as const;
const churaumiSpecies = [
  { name: '鯨鯊', scientificName: 'Rhincodon typus', habitat: '黑潮之海',
    clue: '體型巨大的濾食性鯊魚；館方圖鑑介紹牠如何攝食浮游生物。',
    image: '/assets/species-churaumi-whale-shark-commons.jpg', imageAlt: '沖繩美麗海水族館過往展場中游過大水槽的鯨鯊',
    imageNote: '美麗海過往展場照片｜非今日展示紀錄',
    imageSource: 'https://commons.wikimedia.org/wiki/File:Whale_shark_at_Churauma_Aquarium,_Okinawa.jpg',
    url: 'https://churaumi.okinawa/fishbook/00000510/' },
  { name: '大鬼蝠魟', scientificName: 'Mobula birostris', habitat: '黑潮之海',
    clue: '留意寬大的胸鰭與游動姿態；館方圖鑑說明牠與其他蝠魟的差異。',
    image: '/assets/species-giant-manta-commons.jpg', imageAlt: '大鬼蝠魟在泰國海域游動的野外照片',
    imageNote: '物種示意｜泰國野外照片，非館內展示',
    imageSource: 'https://commons.wikimedia.org/wiki/File:Giant_oceanic_manta_ray.jpg',
    url: 'https://churaumi.okinawa/fishbook/1543394214/' },
] as const;
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

function useProgrammes(path: string | null) {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    if (!path) return () => controller.abort();
    fetch(path, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('無法載入'); return response.json(); })
      .then((body: Response) => setData(body))
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [path]);
  return { data, error };
}

function Performances() {
  const [period, setPeriod] = useState<'upcoming' | 'all'>('upcoming');
  const { data, error } = useProgrammes(`/performances?period=${period}&limit=100`);
  const statusLabel = (session: Session) => {
    if (session.status === 'scheduled') return '館方列有場次，票況未確認';
    if (session.status === 'sold_out') return session.statusOrigin === 'manual'
      ? '人工核對：售罄／額滿' : '館方標示：售罄／額滿';
    if (session.status === 'cancelled') return '人工核對：已取消';
    if (session.status === 'postponed') return '人工核對：已延期';
    return '狀態待核對';
  };
  return <section className="domain-section" id="performances" aria-labelledby="performances-title">
    <span id="expeditions" aria-hidden="true"/>
    <div className="section-kicker"><span>06</span> PERFORMANCE FIELD NOTES</div>
    <div className="intro-heading"><h2 id="performances-title">舞臺上的故事，<em>從場次開始。</em></h2>
      <p>同一節目可能演出不只一次。從臺中國家歌劇院的場次與廳，找到想看的時間。</p></div>
    <p className="domain-caveat">預設只列尚未開始的場次；有成功取得官網清單時，也會排除清單已不再列出的節目。這不是即時或完整節目表；購票與最新異動請以<a href={nttSource} target="_blank" rel="noopener noreferrer">歌劇院官方節目頁 ↗</a>為準。</p>
    <div className="domain-tabs" aria-label="表演節目檢視範圍">
      <button type="button" className={period === 'upcoming' ? 'active' : ''}
        aria-pressed={period === 'upcoming'} onClick={() => setPeriod('upcoming')}>即將演出</button>
      <button type="button" className={period === 'all' ? 'active' : ''}
        aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>完整紀錄與異動</button>
    </div>
    {error ? <p className="domain-message">節目暫時無法載入，請查看館方網站。</p>
      : !data ? <p className="domain-message" role="status">正在翻閱演出檔案…</p>
      : data.total === 0 ? <p className="domain-message">目前沒有可核對的{period === 'upcoming' ? '未來場次' : '節目紀錄'}，請查看館方節目頁。</p>
      : <div className="domain-grid">{data.items.map((item) => <article className="domain-card" key={item.id}>
        <span>PERFORMANCE / 台中</span><h3>{item.title}</h3>
        {item.sessions?.length ? <ul>{item.sessions.map((session) => <li key={session.startsAt}>
          <b>{dateTime(session.startsAt)}</b><small>{session.hall ? ` · ${session.hall}` : ''} · {statusLabel(session)}
            {session.statusReviewedAt ? `（核對於 ${dateTime(session.statusReviewedAt)}）` : ''}</small>
          {session.statusEvidenceUrl && <a href={session.statusEvidenceUrl} target="_blank"
            rel="noopener noreferrer">查看異動依據 ↗</a>}
        </li>)}</ul> : null}
        {item.priceNote && <p>{item.priceNote}</p>}
        <small>資料核對：{dateTime(item.sourceCheckedAt)}</small>
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看館方節目詳情 ↗</a>
      </article>)}</div>}
    {data && data.total > data.items.length && <p className="domain-caveat">目前顯示前 {data.items.length} 筆，共 {data.total} 筆；更多紀錄可透過 API 分頁查詢。</p>}
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
  const [historyDate, setHistoryDate] = useState('');
  const [observedDays, setObservedDays] = useState<string[]>([]);
  const latest = useProgrammes('/marine-programmes?limit=100');
  const [exhibitions, setExhibitions] = useState<SeaExhibitionResponse | null>(null);
  const [exhibitionError, setExhibitionError] = useState(false);
  const archive = useProgrammes(historyDate ? `/marine-programmes?date=${historyDate}&limit=100` : null);
  const { data, error } = historyDate ? archive : latest;
  const [activeLayer, setActiveLayer] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/exhibitions?museum=nmmba&status=active&limit=100', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('無法載入展覽'); return response.json(); })
      .then((body: SeaExhibitionResponse) => setExhibitions(body))
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setExhibitionError(true); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/marine-observation-days?limit=100', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('無法載入觀察日期')))
      .then((body: { items: { date: string }[] }) => setObservedDays(body.items.map((item) => item.date)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
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
  const latestObservedOn = latest.data?.items[0]?.observedOn;
  const observationChanges = historyDate && data && latest.data && latestObservedOn
    && latestObservedOn !== historyDate
    ? compareMarineObservations(data.items,latest.data.items) : null;
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
      <p className="sea-coordinate">PINGTUNG / TAIWAN → MOTOBU / OKINAWA</p>
      <h2 id="deep-sea-title">深海<em>探勘</em></h2>
      <p className="sea-lede">從屏東海生館的展覽與每日節目出發，再游向沖繩美麗海水族館。兩座館的資料來源與更新方式各自標示。</p>
      <a className="sea-dive-link" href="#sea-taiwan">向下探索 <span aria-hidden="true">↓</span></a>
      <p className="sea-disclaimer">這是視覺化的下潛旅程；分層不代表展館樓層或生物棲息深度。</p>
    </div><div className="sea-horizon" aria-hidden="true"><span/><span/><span/></div></div>
    <div className="sea-body">
      <aside className="sea-depth-guide" aria-label="下潛章節">{seaLayers.map((layer, index) =>
        <a key={layer.english} href={`#sea-layer-${index + 1}`} aria-current={activeLayer === index ? 'step' : undefined}>
          <span className="sea-depth-dot" aria-hidden="true"/><span>{layer.title}</span>
        </a>)}</aside>
      <div className="sea-journey">
        <nav className="sea-museum-nav" aria-label="深海探勘館所"><a href="#sea-taiwan">01 / 屏東海生館</a><a href="#sea-okinawa">02 / 沖繩美麗海</a></nav>
        <div className="sea-museum-heading" id="sea-taiwan"><span>EXPEDITION 01 / PINGTUNG</span><h3>國立海洋生物博物館</h3><p>限期展、當日節目與海洋生物線索，從不同角度認識同一座館。</p><a href="/guides/nmmba.html">閱讀海生館館所介紹 ↗</a></div>
        <section className="sea-exhibitions" aria-labelledby="sea-exhibitions-title">
          <div className="sea-subheading"><span>EXHIBITIONS / 01</span><h4 id="sea-exhibitions-title">海生館展覽</h4><p>由現有展覽資料庫讀取未結束的限期展；日期與是否仍開放請逐筆核對館方。</p></div>
          {exhibitionError ? <p className="sea-message">展覽暫時無法載入，請查看<a href="https://www.nmmba.gov.tw/News.aspx?n=3BA711487C292039" target="_blank" rel="noopener noreferrer">館方展覽頁 ↗</a>。</p>
            : !exhibitions ? <p className="sea-message" role="status">正在尋找海生館展覽…</p>
            : exhibitions.total === 0 ? <p className="sea-message">目前沒有已核對展期且未結束的展覽；常設展請看館所介紹，最新資訊請查館方。</p>
            : <div className="sea-exhibition-grid">{exhibitions.items.map((item) => <article className="sea-exhibition-card" key={item.id}>
              <span>{item.exhibitionStatus === 'upcoming' ? '即將展出' : '展出中'} / {item.startDate} — {item.endDate}</span><h5>{item.title}</h5>
              {item.summary && <p>{item.summary}</p>}<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">核對館方展覽 ↗</a>
            </article>)}</div>}
          <a className="sea-more-link" href="/?museum=nmmba#explore-title">使用狀態篩選查看海生館全部展覽 ↗</a>
        </section>
        <div className="sea-subheading" id="sea-programmes"><span>DAILY PROGRAMMES / 02</span><h4>餵食與定點解說</h4><p>以下節目依海生館當日頁匯入，歷史快照只代表觀察當天。</p></div>
        <label className="sea-observation-picker">選擇觀察紀錄
          <select value={historyDate} onChange={(event) => setHistoryDate(event.target.value)}>
            <option value="">最近一次成功匯入</option>
            {observedDays.map((date) => <option value={date} key={date}>{date} 歷史快照</option>)}
          </select>
        </label>
        <div className={`sea-freshness${isToday ? '' : ' sea-freshness-old'}`}>
          <span>資料觀察</span><strong>{observedOn ? `${observedOn} 官網當日節目` : '尚無當日節目資料'}</strong>
          <p>{historyDate ? '這是當日曾成功匯入的最後一版歷史快照，不代表現在或未來仍有相同時段。' : isToday ? '這是官網今日列出的時段；場次仍可能臨時調整。' : '這份紀錄不是今天的節目保證。出發前請先查看館方當日頁面。'} 特殊開館與休館請另外核對<a href="https://www.nmmba.gov.tw/cp.aspx?n=A6476B49BA86BBD5&s=B3CCAAE6060F5DB7" target="_blank" rel="noopener noreferrer">館方服務資訊 ↗</a></p>
        </div>
        {observationChanges && <div className="sea-comparison">
          <h3>{historyDate} ↔ {latestObservedOn} 時段對照</h3>
          <p>比較兩次成功觀察的節目表；差異可能來自當日安排，不能直接判定取消或預告。</p>
          {observationChanges.length === 0 ? <p>兩次觀察的節目與時段相同。</p>
            : <ul>{observationChanges.map((entry) => <li key={entry.key}>
              <strong>{entry.title}</strong>
              <span>{entry.kind === 'added' ? '最近觀察新增：' : entry.kind === 'removed'
                ? '最近觀察未列出：' : '時段變化：'}
                {entry.before.length ? entry.before.join('、') : '未列出'} → {entry.after.length ? entry.after.join('、') : '未列出'}</span>
            </li>)}</ul>}
        </div>}
        {error ? <p className="sea-message">當日節目資料暫時無法載入，請直接查看<a href={marineSource} target="_blank" rel="noopener noreferrer">海生館官方頁 ↗</a>。</p>
          : !data ? <p className="sea-message" role="status">正在下潛，尋找海洋線索…</p>
          : data.total === 0 ? <p className="sea-message">{historyDate ? '這一天沒有已保存的完整節目快照。' : '目前沒有可核對的節目資料，請查看館方當日頁面。'}</p>
          : seaLayers.map((layer, index) => {
            const layerItems = items.slice(index * chunkSize, (index + 1) * chunkSize);
            if (!layerItems.length) return null;
            return <div className={`sea-layer sea-layer-${index + 1}`} id={`sea-layer-${index + 1}`} data-layer={index} key={layer.english}>
              <div className="sea-layer-heading"><span>{layer.english}</span><h3>{layer.title}</h3><p>{layer.note}</p></div>
              <div className="marine-grid">{layerItems.map((item, itemIndex) =>
                <MarineCard key={item.id} item={item} number={index * chunkSize + itemIndex + 1}/>)}</div>
            </div>;
          })}
        <section className="sea-species" aria-labelledby="sea-species-title"><div className="sea-subheading"><span>FIELD GUIDE / 03</span><h4 id="sea-species-title">海生館生物圖鑑</h4><p>挑三組館方展區介紹提到的生物，作為探索入口；活體與展區配置可能變動，並非當日展示保證。</p></div>
          <div className="sea-species-grid">{marineSpecies.map((species, index) => <article className="sea-species-card" key={species.name}>
            <figure className="sea-species-image"><img src={species.image} alt={species.imageAlt} loading="lazy" decoding="async"/>
              <figcaption>{species.imageNote} · <a href={species.imageSource} target="_blank" rel="noopener noreferrer">照片來源 ↗</a></figcaption></figure>
            <span>SPECIMEN / {String(index + 1).padStart(2, '0')}</span><h5>{species.name}</h5><small>{species.habitat}</small><p>{species.clue}</p><a href={species.url} target="_blank" rel="noopener noreferrer">閱讀館方介紹 ↗</a>
          </article>)}</div></section>
        <section className="sea-okinawa" id="sea-okinawa" aria-labelledby="sea-okinawa-title">
          <div className="sea-museum-heading"><span>EXPEDITION 02 / OKINAWA</span><h3 id="sea-okinawa-title">沖繩美麗海水族館</h3><p>官網動線由珊瑚礁、黑潮之海走向深海。這裡先整理館方展區和節目頁，時間為人工核對紀錄，尚未接入每日自動匯入。</p><a href="/guides/okinawa-churaumi.html">閱讀沖繩館所介紹 ↗</a></div>
          <div className="sea-okinawa-layout"><img src="/assets/okinawa-churaumi-commons.jpg" alt="沖繩美麗海水族館黑潮之海的大水槽，鯨鯊從觀眾前方游過" loading="lazy"/><div><span>CHURAUMI / 2026.10.16 核對</span><h4>從珊瑚走入黑潮</h4><p>3F 珊瑚礁、2F 黑潮之海與 1F 深海展區，依<a href={churaumiSource} target="_blank" rel="noopener noreferrer">館方樓層圖 ↗</a>安排閱讀路線。照片為 2015 年展場紀錄，<a href="/photo-credits.html">查看授權 ↗</a>。</p></div></div>
          <section className="sea-core" id="sea-okinawa-core" aria-labelledby="sea-okinawa-core-title">
            <div className="sea-subheading"><span>CORE EXHIBITIONS / 03</span><h4 id="sea-okinawa-core-title">核心常設展區</h4><p>依館方樓層圖由 3F 走向 1F。這是長期參觀動線，不是有起訖日期的限期特展；活體與展示內容請以館方當日資訊為準。</p></div>
            <div className="sea-core-grid">{churaumiCoreAreas.map((area, index) => <article className="sea-core-card" key={area.floor}>
              <div className="sea-core-number"><span>{String(index + 1).padStart(2, '0')}</span><strong>{area.floor}</strong></div>
              <div><small>{area.subtitle}</small><h5>{area.title}</h5><p>{area.description}</p><a href={area.url} target="_blank" rel="noopener noreferrer">閱讀館方展區介紹 ↗</a></div>
            </article>)}</div>
          </section>
          <div className="sea-subheading"><span>FEEDING & SHOW / JST · UTC+9</span><h4>餵食與解說線索</h4><p>官網於 2026/10/16 核對時列出的日本當地時段；動物狀況、維修與臨時公告可能改變安排，出發前請點開官方頁。</p></div>
          <div className="marine-grid">{churaumiProgrammes.map((programme, index) => <article className="marine-card" key={programme.name}>
            <div className="marine-card-top"><span>OKINAWA / {String(index + 1).padStart(2, '0')}</span><span aria-hidden="true">✧</span></div><h4>{programme.name}</h4><p className="marine-venue">{programme.place}</p><p className="marine-price">日本當地時間｜{programme.times}</p><p className="marine-price">{programme.note}</p><a href={programme.url} target="_blank" rel="noopener noreferrer">核對館方節目頁 ↗</a>
          </article>)}</div>
          <section className="sea-species sea-okinawa-species" aria-labelledby="sea-okinawa-species-title"><div className="sea-subheading"><span>FIELD GUIDE / OKINAWA</span><h4 id="sea-okinawa-species-title">美麗海生物圖鑑</h4><p>先挑兩種館方圖鑑介紹的黑潮生物，保留學名與原始條目。這是生物線索，不能據此保證當日展示；<a href="https://churaumi.okinawa/sp/tc/fishbook/" target="_blank" rel="noopener noreferrer">瀏覽館方完整生物圖鑑 ↗</a></p></div>
            <div className="sea-species-grid">{churaumiSpecies.map((species, index) => <article className="sea-species-card" key={species.scientificName}>
              <figure className="sea-species-image"><img src={species.image} alt={species.imageAlt} loading="lazy" decoding="async"/>
                <figcaption>{species.imageNote} · <a href={species.imageSource} target="_blank" rel="noopener noreferrer">照片來源 ↗</a></figcaption></figure>
              <span>SPECIMEN / {String(index + 1).padStart(2, '0')}</span><h5>{species.name}</h5><small>{species.scientificName} · {species.habitat}</small><p>{species.clue}</p><a href={species.url} target="_blank" rel="noopener noreferrer">閱讀館方生物條目 ↗</a>
            </article>)}</div></section>
          <div className="sea-floor"><span aria-hidden="true">✧</span><p>兩座海洋現場，都值得親自去看。</p><a href="/guides/okinawa-churaumi.html">查看沖繩參觀資訊 ↗</a></div>
        </section>
      </div>
    </div>
  </section>;
}

export function DomainProgrammes() {
  return <><Performances/><DeepSeaExpedition/></>;
}
