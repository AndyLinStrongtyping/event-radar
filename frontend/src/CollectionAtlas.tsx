import { useEffect, useRef, useState } from 'react';
import { atlasEntries, atlasEntryFor, type AtlasCategory } from './collection-atlas';
import { appUrl, backendUrl } from './runtime-url';
import './atlas.css';

const categories: ('全部' | AtlasCategory)[] = ['全部', '器物與歷史', '藝術與聲音', '科學與技術', '生命與化石', '建築'];
const glyphs: Record<AtlasCategory, string> = { '器物與歷史': '◈', '藝術與聲音': '✦', '科學與技術': '⚙', '生命與化石': '❧', '建築': '⌂' };
const fromUrl = () => atlasEntryFor(new URLSearchParams(window.location.search).get('museum'));

export function CollectionAtlas() {
  const [entry, setEntry] = useState(fromUrl);
  const [category, setCategory] = useState<(typeof categories)[number]>('全部');
  const scrollAfterSelection = useRef(false);
  useEffect(() => {
    const restore = () => { setEntry(fromUrl()); setCategory('全部'); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => { document.title = `${entry.title}｜館藏與展品圖鑑－展館雷達`; }, [entry]);
  useEffect(() => {
    if (!scrollAfterSelection.current) return;
    scrollAfterSelection.current = false;
    document.getElementById('atlas-record')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    document.getElementById('atlas-record-title')?.focus({ preventScroll: true });
  }, [entry]);

  const visible = atlasEntries.filter((item) => category === '全部' || item.category === category);
  function select(museum: string) {
    const next = atlasEntryFor(museum);
    const url = new URL(window.location.href);
    url.searchParams.set('museum', next.museum);
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    setEntry(next);
  }
  function filter(next: (typeof categories)[number]) {
    setCategory(next);
    if (next !== '全部' && entry.category !== next) select(atlasEntries.find((item) => item.category === next)!.museum);
  }

  return <section className="collection-atlas" aria-labelledby="atlas-title">
    <div className="atlas-heading"><p className="eyebrow">THE ENCYCLOPEDIA / 第一冊</p><h1 id="atlas-title">館藏與展品<span>圖鑑</span></h1><p>從一件器物、一種生命，讀懂一座館。14 座館舍，每館先選一個值得停下來觀察的入口。</p><div className="atlas-editor-note">知識導覽・人工整理於 2026/10/26<br/>這是館藏與主題選讀，不是當日展件清單。概念插畫與實物照片分別標示，現場展出請看館方公告。</div></div>
    <div className="atlas-filters" role="group" aria-label="篩選圖鑑主題">{categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => filter(item)}>{item}</button>)}</div>
    <div className="atlas-layout">
      <nav className="atlas-index" aria-label="選擇館舍圖鑑"><p>館舍索引 <span>{visible.length} / 14</span></p>{visible.map((item) => <button key={item.museum} type="button" aria-pressed={entry.museum === item.museum} onClick={() => select(item.museum)}><i aria-hidden="true">{glyphs[item.category]}</i><span>{item.venue}<small>{item.title}</small></span><b aria-hidden="true">›</b></button>)}</nav>
      <article className="atlas-record" id="atlas-record" aria-labelledby="atlas-record-title">
        <div className="atlas-record-top"><span>{entry.category}</span><span>檔案 {String(atlasEntries.indexOf(entry) + 1).padStart(2, '0')} / 14</span></div>
        <div className="atlas-object">
          <figure><div className={`atlas-image ${entry.imageKind}`}><img key={entry.image} src={appUrl(entry.image)} alt={`${entry.title}的${entry.imageKind === 'illustration' ? 'AI 概念插畫' : '參考照片'}`} width="800" height="800"/><span>{entry.imageKind === 'illustration' ? 'AI 概念插畫' : '參考照片'}</span></div><figcaption>{entry.imageNote}</figcaption></figure>
          <div className="atlas-object-copy"><div className="atlas-medallion" aria-hidden="true">{glyphs[entry.category]}</div><p className="atlas-venue">{entry.venue}</p><h2 id="atlas-record-title" tabIndex={-1}>{entry.title}</h2><p className="atlas-era">{entry.era}</p><p className="atlas-relationship">{entry.relationship}</p><a className="atlas-guide-link" href={backendUrl(`/guides/${entry.museum}.html`)}>館舍介紹與參觀資訊 ↗</a></div>
        </div>
        <div className="atlas-reading"><div><h3>{entry.subjectType === 'animal' ? '這種生命，值得觀察什麼？' : entry.subjectType === 'architecture' ? '這座建築，為什麼值得看？' : '這件展品，為什麼值得看？'}</h3><p>{entry.introduction}</p><h3>帶著三個觀察去現場</h3><ol>{entry.observations.map((point) => <li key={point}>{point}</li>)}</ol></div><aside><span>再想一步</span><p>{entry.question}</p><h3>資料出處</h3><a href={entry.source.url} target="_blank" rel="noopener noreferrer">{entry.source.title} ↗</a>{entry.extension && <a href={entry.extension.url} target="_blank" rel="noopener noreferrer">{entry.extension.title} ↗</a>}<a href={backendUrl('/photo-credits.html#atlas-illustrations')}>圖片出處與使用說明 ↗</a><small>文字為本站摘要與觀察引導；分類、年代及展況以原始資料與館方最新標示為準。</small></aside></div>
        <div className="atlas-related"><h3>下一頁，換個角度探索</h3><div>{atlasEntries.filter((item) => item.museum !== entry.museum && item.category === entry.category).slice(0, 3).map((item) => <button key={item.museum} type="button" onClick={() => { scrollAfterSelection.current = true; select(item.museum); }}><span>{item.venue}</span><strong>{item.title} ↗</strong></button>)}{entry.category === '建築' && <a href={appUrl('explore/collections/?museum=ntmofa')}>換看藝術與聲音：水牛群像 ↗</a>}</div></div>
      </article>
    </div>
  </section>;
}
