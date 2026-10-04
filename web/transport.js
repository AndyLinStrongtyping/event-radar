const transportByGuide = {
  'chimei.html': {
    name: '奇美博物館', city: '臺南市', destination: '奇美博物館 臺南市仁德區文華路二段66號',
    note: '臺鐵保安站步行約 15 分鐘；從高鐵臺南站也可依館方資訊轉乘沙崙線或快捷公車。',
    official: 'https://www.chimeimuseum.org/index.php/visit',
  },
  'nmns.html': {
    name: '國立自然科學博物館', city: '臺中市', destination: '國立自然科學博物館 臺中市北區館前路1號',
    note: '可搭乘行經臺灣大道的公車至「科博館」站；植物園入口與主館不同，請在地圖中確認最後步行路段。',
    official: 'https://www.nmns.edu.tw/ch/visit/traffic/',
  },
  'ntm.html': {
    name: '國立臺灣博物館本館', city: '臺北市', destination: '國立臺灣博物館本館 臺北市中正區襄陽路2號',
    note: '本頁介紹的是二二八和平公園內的「本館」；臺博館其他館區地址不同，請確認目的地。',
    official: 'https://www.ntm.gov.tw/cp.aspx?Create=1&n=5459',
  },
  'nmth.html': {
    name: '國立臺灣歷史博物館', city: '臺南市', destination: '國立臺灣歷史博物館 臺南市安南區長和路一段250號',
    note: '館方交通頁列有臺南市公車及停車資訊；公車班次與轉乘請在出發前核對。',
    official: 'https://www.nmth.gov.tw/cp.aspx?Create=1&n=4101',
  },
  'npm-south.html': {
    name: '故宮南院', city: '嘉義縣', destination: '國立故宮博物院南部院區 嘉義縣太保市故宮大道888號',
    note: '從高鐵嘉義站可依館方資訊轉搭接駁車或公車；班次與停靠站請以當日公告為準。',
    official: 'https://south.npm.gov.tw/FAQDetailC005400.aspx?Cond=6994b5f5-ccd6-48b3-bdb2-5449457e8bc9',
  },
  'nstm.html': {
    name: '國立科學工藝博物館北館', city: '高雄市', destination: '國立科學工藝博物館北館 高雄市三民區九如一路720號',
    note: '臺鐵「科工館站」下車後，館方估計步行約 10 分鐘；本頁展廳位於北館。',
    official: 'https://www.nstm.gov.tw/Reference/VisitorInformation/TrafficInfo.htm',
  },
  'ntsec.html': {
    name: '國立臺灣科學教育館', city: '臺北市', destination: '國立臺灣科學教育館 臺北市士林區士商路189號',
    note: '可從捷運士林站或劍潭站轉乘公車至「國立科教館」站；館方另有地下停車場資訊。',
    official: 'https://www.ntsec.gov.tw/article/detail.aspx?a=22',
  },
};

const counties = [
  '臺北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '臺中市',
  '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣',
  '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣',
];

const guide = transportByGuide[location.pathname.split('/').pop()];
const content = document.querySelector('.guide-content');

if (guide && content) {
  const section = document.createElement('section');
  section.className = 'transport-plan';
  section.setAttribute('aria-labelledby', 'transport-title');
  section.innerHTML = `
    <p class="eyebrow dark">PLAN YOUR VISIT</p>
    <h2 id="transport-title">怎麼去這座館？</h2>
    <p class="transport-note"></p>
    <p class="transport-address"></p>
    <form class="transport-form">
      <label>從哪個縣市出發？
        <select name="county" required><option value="">選擇縣市</option></select>
      </label>
      <label>更準確的出發地點（選填）
        <input name="origin" type="text" maxlength="120" autocomplete="street-address" placeholder="例如：臺中車站，或完整地址">
      </label>
      <button type="submit">查看交通路線 ↗</button>
    </form>
    <p class="transport-hint">只選縣市時，會以該縣市政府作示意起點；請在地圖中改成實際出發位置。本站不會儲存輸入地點，開啟路線時才會交給 Google Maps。</p>
    <div class="transport-result" role="status" hidden>
      <p class="transport-summary"></p>
      <div class="transport-actions">
        <a class="transit-link" target="_blank" rel="noopener noreferrer">查看大眾運輸路線 ↗</a>
        <a class="driving-link" target="_blank" rel="noopener noreferrer">查看開車路線 ↗</a>
      </div>
      <p>時間、費用、班次及轉乘以地圖與運輸業者的即時資訊為準。單靠縣市無法判定最快或最省錢的方式。</p>
    </div>
    <a class="transport-official" target="_blank" rel="noopener noreferrer">查看館方交通資訊 ↗</a>
  `;
  section.querySelector('.transport-note').textContent = guide.note;
  section.querySelector('.transport-address').textContent = `目的地：${guide.destination}`;
  section.querySelector('.transport-official').href = guide.official;

  const select = section.querySelector('select[name="county"]');
  for (const county of counties) {
    const option = document.createElement('option');
    option.value = county;
    option.textContent = county;
    select.append(option);
  }

  section.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const county = select.value;
    if (!county) return;
    const exact = section.querySelector('input[name="origin"]').value.trim();
    const origin = exact || `${county}政府`;
    const directions = (travelmode) => {
      const url = new URL('https://www.google.com/maps/dir/');
      url.searchParams.set('api', '1');
      url.searchParams.set('origin', origin);
      url.searchParams.set('destination', guide.destination);
      url.searchParams.set('travelmode', travelmode);
      return url.href;
    };
    section.querySelector('.transit-link').href = directions('transit');
    section.querySelector('.driving-link').href = directions('driving');
    section.querySelector('.transport-summary').textContent = `出發：${origin} → ${guide.name}${exact ? '' : '（示意起點）'}`;
    section.querySelector('.transport-result').hidden = false;
  });

  content.querySelector('.guide-next')?.before(section);
}
