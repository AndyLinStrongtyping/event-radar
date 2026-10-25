import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DeepSeaExpedition } from './DomainProgrammes';
import { FossilExpedition } from './FossilExpedition';
import { appUrl, backendUrl } from './runtime-url';
import './styles.css';

const theme = document.body.dataset.theme;
if (theme !== 'ocean' && theme !== 'fossils') throw new Error('未知探索主題');

function ThemePage({ kind }: { kind: 'ocean' | 'fossils' }) {
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const update = () => setShowBackToTop(window.scrollY > 600);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const ocean = kind === 'ocean';

  return <>
    <a className="skip-link" href={ocean ? '#deep-sea-title' : '#fossils-title'}>跳到主題內容</a>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href={appUrl()} aria-label="展館雷達首頁"><span className="brand-glyph">✧</span><span>展館 <b>雷達</b><small>博物館・美術館・表演與自然探索</small></span></a>
      <nav aria-label="主要導覽"><a href={appUrl('#explore-title')}>搜尋特展</a><a href={appUrl('explore/ocean/')} aria-current={ocean ? 'page' : undefined}>深海探勘</a><a href={appUrl('explore/fossils/')} aria-current={!ocean ? 'page' : undefined}>化石探勘</a><a href={appUrl('#guides')}>館所圖鑑</a></nav>
      <span className="header-edition">FIELD JOURNAL <i>{ocean ? 'OCEAN' : 'FOSSILS'}</i></span>
    </div></header>
    <main id="theme-main">
      <div className="theme-breadcrumb" aria-label="目前位置"><a href={appUrl()}>展館雷達首頁</a><span aria-hidden="true">/</span><strong>{ocean ? '深海探勘' : '化石探勘'}</strong></div>
      {ocean ? <DeepSeaExpedition/> : <FossilExpedition/>}
      <nav className="theme-next" aria-label="繼續探索"><div><span>CONTINUE EXPLORING</span><h2>下一站，沿著新的線索前進。</h2></div><div><a href={appUrl('#explore-title')}>搜尋當期特展 ↗</a><a href={appUrl(ocean ? 'explore/fossils/' : 'explore/ocean/')}>{ocean ? '前往化石探勘' : '前往深海探勘'} ↗</a></div></nav>
    </main>
    <footer className="site-footer"><div><span className="footer-brand">✧ 展館雷達</span><p>沿著真實資料，繼續探索未知。</p></div><p>展區與行前資訊以館方最新公告為準。<a href={backendUrl('/privacy.html')}>網站流量與隱私說明</a></p><a href={appUrl()}>返回首頁 ↑</a></footer>
    <button className="back-to-top" type="button" hidden={!showBackToTop} aria-label="回到頂部" title="回到頂部" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}><span aria-hidden="true">↑</span></button>
  </>;
}

createRoot(document.getElementById('root')!).render(<ThemePage kind={theme}/>);
