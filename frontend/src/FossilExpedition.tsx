import { useState } from 'react';

type Fossil = {
  name: string; period: string; clue: string; image?: string; alt?: string;
  imageNote: string; imageSource?: string; sourceUrl: string;
};
type Venue = {
  id: 'penghu' | 'zuojhen'; name: string; region: string; number: string; lead: string;
  officialUrl: string; guideUrl: string; hours: string; hoursNote: string;
  halls: Array<{ floor: string; title: string; detail: string; url: string }>;
  fossils: Fossil[];
};

const venues: Venue[] = [
  {
    id: 'penghu', name: '澎湖化石館', region: '澎湖・馬公', number: '01',
    lead: '沿著澎湖水道的古環境，走近中新世的潘氏澎湖鱷。',
    officialUrl: 'https://www.penghu.gov.tw/phhcc/home.jsp?id=115',
    guideUrl: '/guides/penghu-fossil.html',
    hours: '09:00–12:00、14:00–17:00',
    hoursNote: '文化局兩處頁面對週二是否開館記載不一；日期、午休與臨時休館請出發前向館方確認。',
    halls: [
      { floor: '1F', title: '澎湖水道的傳奇', detail: '從沉積與地質變遷，認識曾經生活在澎湖水道的古生物。', url: 'https://www.penghu.gov.tw/phhcc/home.jsp?id=115' },
      { floor: '2F', title: '古老霸主・潘氏澎湖鱷', detail: '以館方展示的完整化石，認識約 1,500–1,700 萬年前的鱷類。', url: 'https://www.penghu.gov.tw/phhcc/home.jsp?id=115' },
      { floor: '2F', title: '海洋巨獸・布氏鯨', detail: '擱淺鯨骨的重新鑑定故事；這是骨骼標本，不是化石。', url: 'https://www.penghu.gov.tw/phhcc/home.jsp?id=115' },
    ],
    fossils: [
      { name: '潘氏澎湖鱷', period: '中新世・約 1,500–1,700 萬年前', clue: '澎湖化石館的焦點。先觀察狹長頭骨與完整骨架，再由館方介紹了解修復與研究。',
        imageNote: '輪廓示意｜非標本照片；實物請看館方頁', sourceUrl: 'https://www.penghu.gov.tw/phhcc/home.jsp?id=115' },
      { name: '澎湖水道古菱齒象', period: '更新世・澎湖水道相關化石', clue: '以齒化石辨識古代長鼻類；照片攝於臺北的他館，僅作澎湖水道出土化石示例。',
        image: '/assets/fossil-penghu-elephant-commons.jpg', alt: '澎湖水道出土的古菱齒象齒化石，攝於臺北他館',
        imageNote: '相關化石示例｜攝於他館，非澎湖化石館展品紀錄',
        imageSource: 'https://commons.wikimedia.org/wiki/File:古菱齒象齒化石.jpg',
        sourceUrl: 'https://www.penghu.gov.tw/ch/home.jsp?act=buildview&dataserno=202510040002&id=10103' },
    ],
  },
  {
    id: 'zuojhen', name: '臺南左鎮化石園區', region: '臺南・左鎮', number: '02',
    lead: '循菜寮溪的地層線索，從生命演化館走到化石館。',
    officialUrl: 'https://fossil.tnc.gov.tw/', guideUrl: '/guides/zuojhen-fossil.html',
    hours: '09:00–17:00；週三例行休館',
    hoursNote: '館方列最後售票 16:00、最後入園 16:30；國定假日與特殊日請核對最新公告。',
    halls: [
      { floor: '園區', title: '五大展館', detail: '自然史教育館、故事館、生命演化館、化石館與探索館，組成完整參觀動線。', url: 'https://fossil.tnc.gov.tw/' },
      { floor: '化石館 1F', title: '從菜寮溪到海洋世界', detail: '河流、海洋與小動物化石，呈現不同環境留下的證據。', url: 'https://fossil.tnc.gov.tw/content/index.php?m2=58' },
      { floor: '化石館 2F', title: '臺灣史前動物', detail: '犀、象、鹿與爬行動物等化石線索；早坂犀骨架是重點展件。', url: 'https://fossil.tnc.gov.tw/content/index.php?m2=58' },
    ],
    fossils: [
      { name: '早坂犀', period: '更新世・菜寮溪流域', clue: '園區以早坂犀骨架呈現臺灣史前哺乳動物。舊資料也可見「早坂中國犀」名稱。',
        image: '/assets/fossil-zuojhen-rhino-commons.jpg', alt: '左鎮化石園區過往展出的早坂犀骨架',
        imageNote: '左鎮園區過往展場照片｜非今日展件保證',
        imageSource: 'https://commons.wikimedia.org/wiki/File:Nesorhinus_hayasakai_01.jpg',
        sourceUrl: 'https://fossil.tnc.gov.tw/content/index.php?m2=58' },
      { name: '臺灣古鱷', period: '更新世・新化丘陵', clue: '從顎骨與牙齒化石辨識已消失的鱷類；照片為左鎮園區過往館藏紀錄。',
        image: '/assets/fossil-zuojhen-crocodile-commons.jpg', alt: '左鎮化石園區館藏的臺灣鱷化石',
        imageNote: '左鎮園區過往館藏照片｜非今日展件保證',
        imageSource: 'https://commons.wikimedia.org/wiki/File:臺灣鱷化石.jpg',
        sourceUrl: 'https://fossil.tnc.gov.tw/fossil/index.php?m2=31&sid=5' },
    ],
  },
];

function FossilCard({ fossil, index }: { fossil: Fossil; index: number }) {
  return <article className="fossil-card">
    <div className={`fossil-card-image${fossil.image ? '' : ' fossil-card-illustration'}`}>
      {fossil.image ? <img src={fossil.image} alt={fossil.alt} loading="lazy"/> : <svg viewBox="0 0 400 220" role="img" aria-label="鱷類頭骨與脊椎的示意線條，非實物照片"><path d="M62 104c34-16 67-27 119-24 38 2 78 19 116 25l48 24-60 17-82-7-55 12-45-6-50 11 29-27-25-25Z"/><path d="m105 149 22 26 30-10 39 12 42-17 43 8 28-17M83 105l33 25m33-44 22 47m37-45 15 43m38-31 5 33"/><circle cx="288" cy="120" r="5"/></svg>}
      <span>{fossil.imageNote}</span>
    </div>
    <div className="fossil-card-copy"><small>SPECIMEN / {String(index + 1).padStart(2, '0')}</small><h5>{fossil.name}</h5><b>{fossil.period}</b><p>{fossil.clue}</p><div className="fossil-card-links"><a href={fossil.sourceUrl} target="_blank" rel="noopener noreferrer">查看官方資料 ↗</a>{fossil.imageSource && <a href={fossil.imageSource} target="_blank" rel="noopener noreferrer">照片來源 ↗</a>}</div></div>
  </article>;
}

export function FossilExpedition() {
  const [selected, setSelected] = useState<Venue['id']>('penghu');
  const venue = venues.find((item) => item.id === selected)!;
  return <section className="fossil-section" id="fossils" aria-labelledby="fossils-title">
    <div className="fossil-ridge" aria-hidden="true"><span/><span/><span/></div>
    <div className="fossil-inner">
      <div className="section-kicker"><span>08</span> DEEP TIME FIELD NOTES</div>
      <div className="fossil-intro"><div><p className="fossil-overline">PENGHU → ZUOJHEN / 兩座化石館</p><h2 id="fossils-title">穿過地層，<em>遇見遠古生命。</em></h2><p>從澎湖水道的古鱷，到菜寮溪的早坂犀。切換兩座館，讀常設展區、化石線索與出發前要確認的資訊。</p></div><div className="fossil-time-mark" aria-hidden="true"><span>DEEP TIME</span><strong>01 / 02</strong><i>化石探勘</i></div></div>
      <p className="fossil-caveat">本區是 2026/10/16 依館方及政府公開頁人工整理的靜態導覽，沒有自動匯入展覽或每日活動。展件輪替、活動日期、票務及特殊開館以各館公告為準。</p>
      <div className="fossil-venue-tabs" role="group" aria-label="切換化石館">{venues.map((item) => <button key={item.id} type="button" aria-pressed={selected === item.id} className={selected === item.id ? 'active' : ''} onClick={() => setSelected(item.id)}><span>{item.number} / {item.region}</span><strong>{item.name}</strong></button>)}</div>
      <div className="fossil-venue-heading"><div><span>FIELD SITE {venue.number} / {venue.region}</span><h3>{venue.name}</h3><p>{venue.lead}</p></div><a href={venue.guideUrl}>閱讀館所介紹 ↗</a></div>
      <div className="fossil-visit"><div><span>行前確認</span><strong>{venue.hours}</strong><p>{venue.hoursNote}</p></div><a href={venue.officialUrl} target="_blank" rel="noopener noreferrer">查看館方最新資訊 ↗</a></div>
      <div className="fossil-subheading"><span>PERMANENT GALLERIES / 01</span><h4>核心常設展區</h4><p>這些是館方介紹的長期展區，不設虛構的結束日，也不當成當期特展。</p></div>
      <div className="fossil-hall-grid">{venue.halls.map((hall, index) => <article key={hall.title} className="fossil-hall"><div><span>{String(index + 1).padStart(2, '0')}</span><b>{hall.floor}</b></div><h5>{hall.title}</h5><p>{hall.detail}</p><a href={hall.url} target="_blank" rel="noopener noreferrer">查看館方介紹 ↗</a></article>)}</div>
      <div className="fossil-subheading"><span>FOSSIL ATLAS / 02</span><h4>化石圖鑑</h4><p>每張圖都標註是否為館內紀錄。圖鑑介紹的是古生物與標本線索，不代表當天一定展出。</p></div>
      <div className="fossil-card-grid">{venue.fossils.map((fossil, index) => <FossilCard key={fossil.name} fossil={fossil} index={index}/>)}</div>
      <aside className="fossil-activity"><div><span>ACTIVITIES / 03</span><h4>導覽與活動，出發前再核對。</h4><p>目前沒有兩館可持續核對的固定活動場次來源；不把過去活動或新聞發布日當成未來場次。</p></div><a href={venue.officialUrl} target="_blank" rel="noopener noreferrer">查看館方公告 ↗</a></aside>
      <p className="fossil-credit-link">圖像來源、作者與授權見<a href="/photo-credits.html">照片來源頁 ↗</a>。</p>
    </div>
  </section>;
}
