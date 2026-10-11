import { useEffect, useState } from 'react';

type Session = { startsAt: string; hall: string | null; status: string };
type DailyTime = { localTime: string; durationMinutes: number | null; venue: string | null };
type Programme = { id: string; title: string; venue: string | null; sourceUrl: string;
  priceNote: string | null; sourceCheckedAt: string; observedOn: string | null;
  sessions: Session[] | null; dailySchedule: DailyTime[] | null };
type Response = { items: Programme[]; total: number };
const dateTime = (value: string) => new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export function DomainProgrammes() {
  const [mode, setMode] = useState<'performance' | 'marine'>('performance');
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(false);
    fetch(mode === 'performance' ? '/performances' : '/marine-programmes', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('無法載入'); return response.json(); })
      .then((body: Response) => setData(body))
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [mode]);
  return <section className="domain-section" id="expeditions" aria-labelledby="domain-title">
    <div className="section-kicker"><span>06</span> LIVE FIELD NOTES</div>
    <div className="intro-heading"><h2 id="domain-title">演出場次與<em>深海探勘。</em></h2>
      <p>表演以節目和場次整理；海生館顯示官網當日觀察的節目表。兩者的更新時間與確認方式不同。</p></div>
    <div className="domain-tabs" role="group" aria-label="節目類別">
      <button type="button" className={mode === 'performance' ? 'active' : ''} aria-pressed={mode === 'performance'} onClick={() => setMode('performance')}>臺中國家歌劇院</button>
      <button type="button" className={mode === 'marine' ? 'active' : ''} aria-pressed={mode === 'marine'} onClick={() => setMode('marine')}>海生館・深海探勘</button>
    </div>
    <p className="domain-caveat">{mode === 'performance'
      ? '目前只取館方清單首頁的少量節目詳情，並非完整節目表。列有場次不代表仍有票；購票、取消與改期請以館方頁面為準。'
      : '以下是官網當日節目表的觀察紀錄，不保證未來每天相同。餵食解說及特殊開館可能臨時調整，出發前請核對館方公告。'}</p>
    {error ? <p className="domain-message">資料暫時無法載入，請直接查看館方網站。</p>
      : !data ? <p className="domain-message" role="status">正在翻閱節目檔案…</p>
      : data.total === 0 ? <p className="domain-message">目前尚無可核對的節目資料。請查看館方網站。</p>
      : <div className="domain-grid">{data.items.map((item) => <article className="domain-card" key={item.id}>
        <span>{mode === 'performance' ? 'PERFORMANCE / 台中' : 'DEEP SEA / 屏東'}</span>
        <h3>{item.title}</h3>
        {item.venue && <p>{item.venue}</p>}
        {item.sessions?.length ? <ul>{item.sessions.map((session) => <li key={session.startsAt}>
          <b>{dateTime(session.startsAt)}</b><small>{session.hall ? ` · ${session.hall}` : ''} · {session.status === 'unknown' ? '狀態待核對' : '館方列有場次'}</small>
        </li>)}</ul> : null}
        {item.dailySchedule?.length ? <><p>官網 {item.observedOn} 當日列出：</p><ul>{item.dailySchedule.map((entry) => <li key={entry.localTime}>
          <b>{entry.localTime}</b><small>{entry.venue ? ` · ${entry.venue}` : ''}{entry.durationMinutes ? ` · 約 ${entry.durationMinutes} 分鐘` : ''}</small>
        </li>)}</ul></> : null}
        {item.priceNote && <p>{item.priceNote}</p>}
        <small>資料核對：{dateTime(item.sourceCheckedAt)}</small>
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看館方節目詳情 ↗</a>
      </article>)}</div>}
  </section>;
}
