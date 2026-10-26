export type AtlasCategory = '器物與歷史' | '藝術與聲音' | '科學與技術' | '生命與化石' | '建築';
export type AtlasEntry = {
  subjectType: 'object' | 'animal' | 'fossil' | 'architecture';
  museum: string; venue: string; title: string; category: AtlasCategory; era: string;
  image: string; imageKind: 'illustration' | 'photo'; imageNote: string;
  relationship: string; introduction: string; observations: string[]; question: string;
  source: { title: string; url: string }; extension?: { title: string; url: string };
};

// 人工編輯的知識內容，與自動匯入的展期資料分開；不據此宣告當日正在展出。
export const atlasEntries: AtlasEntry[] = [
  {
    subjectType: 'object', museum: 'npm-north', venue: '故宮北院', title: '宗周鐘', category: '器物與歷史', era: '西周晚期',
    image: '/assets/atlas-bell.webp', imageKind: 'illustration', imageNote: 'AI 青銅鐘概念插畫；器形與紋飾非宗周鐘的精確重建，銘文請看官方藏品頁。',
    relationship: '故宮典藏；是否出展須另查展件公告。',
    introduction: '青銅鐘除了發聲，也是把權力、祭祀與記憶連在一起的器物。宗周鐘器身留有銘文，讓研究者能從文字和器形，追問西周王室如何記錄事件。',
    observations: ['先看鐘身、頂部與可懸掛的結構，想像它如何被使用。', '再比較紋飾與文字的位置：裝飾和記錄不一定擔任同一種角色。', '閱讀館方的銘文釋讀，分清器物上實際可見的字與後人的解釋。'],
    question: '如果一段歷史只寫在器物上，保存這件器物也就保存了一份文字檔案。',
    source: { title: '故宮數位典藏：宗周鐘', url: 'https://digitalarchive.npm.gov.tw/Collection/Detail/1464?dep=U' },
  },
  {
    subjectType: 'object', museum: 'npm-south', venue: '故宮南院', title: '唐代長沙窯綠釉單柄壺', category: '器物與歷史', era: '唐代',
    image: '/assets/atlas-ewer.webp', imageKind: 'illustration', imageNote: 'AI 單柄陶壺概念插畫；釉色、比例與細節非該件文物重建。',
    relationship: '館方觀光導覽手冊收錄的茶文化展品；不保證當日出展。',
    introduction: '一把壺不只盛水，也留下飲茶方式的線索。館方在東亞茶文化導覽中介紹這件單柄壺；把它和茶盞、盞托一起看，比只欣賞外形更能理解器物之間的關係。',
    observations: ['看壺嘴、把手和重心：它們影響傾倒與持握。', '留意釉面與器身交接，區分材料、表面處理和使用痕跡。', '比較不同年代茶具，不要把今天泡整葉茶的習慣套用到所有時代。'],
    question: '同樣是喝茶，改變茶的處理方式，也可能改變整套工具。',
    source: { title: '故宮南院：中文觀光導覽手冊（PDF）', url: 'https://south.npm.gov.tw/Uploads/files/故宮好客中文觀光導覽手冊.pdf' },
  },
  {
    subjectType: 'object', museum: 'chimei', venue: '奇美博物館', title: '機械音樂家：自動樂器', category: '藝術與聲音', era: '機械音樂與聲音技術',
    image: '/assets/atlas-music.webp', imageKind: 'illustration', imageNote: 'AI 滾筒風琴題材插畫；非奇美某一件樂器的實物圖。',
    relationship: '取自館方「機械音樂家」展區主題，非單一藏品清冊。',
    introduction: '沒有演奏者站在前面，樂器仍能奏出旋律。奇美以音樂盒、滾筒風琴等自動樂器介紹這種經驗：旋律不只可以寫在紙上，也能轉成機械可以讀取的安排。',
    observations: ['尋找保存演奏指令的部分，和真正發聲的部分。', '觀察動力如何經過機關，最後帶動音樂。', '若有館方演示，對照你看到的運動與聽到的聲音；場次另查公告。'],
    question: '從機械到數位，保存音樂的共同問題是：如何把一段演奏再次呈現？',
    source: { title: '奇美：機械音樂家', url: 'https://www.chimeimuseum.org/permanent-exhibition/604effb1e6e0b' },
  },
  {
    subjectType: 'object', museum: 'nmns', venue: '國立自然科學博物館', title: '古埃及木乃伊與人型棺柩', category: '器物與歷史', era: '古埃及；年代以現場標示為準',
    image: '/assets/atlas-mummy.webp', imageKind: 'illustration', imageNote: 'AI 木乃伊與人型棺概念插畫；非科博館實物，包裹、彩繪與比例不可作考證依據。',
    relationship: '館方生命科學廳介紹的展示；以尊重人類遺體與文化脈絡的方式閱讀。',
    introduction: '館方以男性木乃伊、人型棺柩與影像介紹古埃及生死觀及保存技術。觀看時，可以同時思考文化信仰與研究方法，而不只把它當成神祕的展示物。',
    observations: ['分清人類遺體、包裹材料、棺柩與後來的展示裝置。', '留意圖像和文字如何表達身分與死後世界。', '閱讀館方如何研究與保存，不以外觀猜測姓名、死因或年代。'],
    question: '自然科學與人類文化能一起發問：材料如何保存，而人們為什麼希望保存？',
    source: { title: '科博館：生命科學廳', url: 'https://www.nmns.edu.tw/ch/exhibitions/galleries/life-science-hall/index.html' },
  },
  {
    subjectType: 'object', museum: 'ntm', venue: '國立臺灣博物館', title: '康熙臺灣輿圖', category: '器物與歷史', era: '清代；17、18世紀之際的臺灣圖像',
    image: '/assets/atlas-map.webp', imageKind: 'illustration', imageNote: 'AI 古地圖題材插畫；地形與文字並非臺灣實際地理或原圖內容，不可作地圖使用。',
    relationship: '臺博館典藏與數位介紹；原件、摹本及數位版本須分開辨識。',
    introduction: '這幅長卷把山川、聚落與生活放進同一個視野。古地圖值得看的不只是位置是否準確，還有製圖者選擇畫出什麼、略去什麼，以及當時如何理解地方。',
    observations: ['先讀官方數位圖，找山、河、聚落等不同符號。', '比較圖上方向、距離與今天的地圖，不把古圖當導航。', '遇到數位重建展示，辨認哪些內容屬於原件、摹本或重建。'],
    question: '地圖也是一種敘事：每次選擇畫什麼，都在決定讀者如何認識土地。',
    source: { title: '臺博館：康熙臺灣輿圖數位專題', url: 'https://kangxitaiwanmap.ntm.gov.tw/' },
  },
  {
    subjectType: 'object', museum: 'nmth', venue: '國立臺灣歷史博物館', title: '流通錢幣與臺灣的世界連結', category: '器物與歷史', era: '17～19世紀',
    image: '/assets/atlas-coins.webp', imageKind: 'illustration', imageNote: 'AI 歷史錢幣題材插畫；非臺灣流通幣種或館藏錢幣的精確重製。',
    relationship: '依館方臺灣錢幣研究主題整理，不是單件藏品或現展清單。',
    introduction: '館方用17～19世紀來到臺灣的不同錢幣，說明交易與世界往來。看錢幣不只看面值，也可以觀察材質、形制與流通背景如何反映社會關係。',
    observations: ['比較圓孔、方孔、邊緣與表面文字等可辨識的形制。', '先核對幣種與年代，再討論它來到臺灣的脈絡。', '把官方研究中的流通情況，和個別藏品的來源記錄分開。'],
    question: '一枚小錢幣能把日常買賣，連到遠方的貿易與制度。',
    source: { title: '臺史博：臺灣錢幣．世界脈動', url: 'https://taiwanindex.nmth.gov.tw/theme/detail/77' },
  },
  {
    subjectType: 'object', museum: 'nstm', venue: '國立科學工藝博物館', title: '磁石式電話交換機', category: '科學與技術', era: '人工交換的通訊年代',
    image: '/assets/atlas-switchboard.webp', imageKind: 'illustration', imageNote: 'AI 人工電話交換機概念插畫；非館方指定機型，不代表實際線路與操作構造。',
    relationship: '館方「電信＠臺灣」展覽介紹的人工交換設備。',
    introduction: '手搖電話並不是轉動手柄就直接找到對方。使用者先呼叫接線生，再由人工接通線路；這臺設備讓原本看不見的通訊服務，變成可以觀察的工作流程。',
    observations: ['找插孔、塞繩和呼叫指示，想像一通電話如何被接起。', '分辨呼叫對方的訊號，與承載通話的連接。', '思考接線生需要的判斷、記憶與服務工作。'],
    question: '通訊自動化不只改變機器，也改變了人的工作。',
    source: { title: '科工館：電信＠臺灣', url: 'https://www.nstm.gov.tw/Exhibition.aspx?KeyID=422a9a67-5ad4-460b-9e01-7633be54ebcf' },
  },
  {
    subjectType: 'object', museum: 'ntsec', venue: '國立臺灣科學教育館', title: '半導體製造設備與晶片', category: '科學與技術', era: '現代半導體技術',
    image: '/assets/atlas-chip.webp', imageKind: 'illustration', imageNote: 'AI 半導體設備概念插畫；不代表任何機型的正確構造或操作方式。',
    relationship: '以「半導體未來館」的製造與分工主題為入口，非古文物。',
    introduction: '一枚晶片的背後，有材料、設備、製程與跨領域合作。科教館以展示廳、物料室、製造區與未來實驗室，讓觀眾從不同環節理解這項技術。',
    observations: ['把原料、製造設備和最後的晶片分成不同階段。', '留意展覽如何呈現製程條件與材料選擇。', '追問每一步需要哪些專業，避免把晶片製造想成單一機器的成果。'],
    question: '看不見的微小結構，需要一整套可控制、可重複的製造流程。',
    source: { title: '科教館：半導體未來館', url: 'https://www.ntsec.gov.tw/article/detail.aspx?a=5117' },
  },
  {
    subjectType: 'object', museum: 'ntmofa', venue: '國立臺灣美術館', title: '黃土水《水牛群像》', category: '藝術與聲音', era: '原作1930年；館藏為青銅翻製品',
    image: '/assets/atlas-buffalo.webp', imageKind: 'illustration', imageNote: 'AI 水牛浮雕題材概念插畫；非黃土水作品的構圖重製，不可據此辨認原作細節。',
    relationship: '國美館典藏青銅翻製品；石膏原作位於臺北中山堂。',
    introduction: '這件作品以浮雕呈現牧童、水牛與臺灣農村景象。館藏青銅翻製品與石膏原作的材料不同，閱讀時要把創作年代、翻製與典藏關係分清楚。',
    observations: ['看人物、牛隻與植物如何重疊，產生前後層次。', '移動觀看位置，留意淺浮雕如何用光影塑造體積。', '核對材質與版本，不把翻製品誤寫成石膏原作。'],
    question: '複製能讓更多人接近作品，但清楚交代版本，也是理解藝術的一部分。',
    source: { title: '文化部典藏網：國美館水牛群像', url: 'https://collections.culture.tw/Object?RNO=MDc4MDAxNjE%3D&SYSUID=12' },
    extension: { title: '臺北市文化小旅行：中山堂與石膏原作', url: 'https://miniculturaltrips.gov.taipei/News_Content.aspx?n=0E170AD95646630E&s=97BED5754F37D338&sms=DC4BFB02CE861520' },
  },
  {
    subjectType: 'animal', museum: 'nmmba', venue: '國立海洋生物博物館', title: '白鯨：用聲音認識環境', category: '生命與化石', era: '現生海洋哺乳動物',
    image: '/assets/atlas-beluga-3d-aged-v2.webp', imageKind: 'illustration', imageNote: 'AI 白鯨概念插畫，3D造型搭配仿舊相紙色調；非歷史或現場照片，比例與表情為藝術化呈現。',
    relationship: '生物觀察主題，不是古文物；現場個體與節目以館方公告為準。',
    introduction: '白鯨的觀察不只在外形。海生館的白鯨展示與研究介紹，也涉及聲音、聽覺和行為；理解動物如何感知環境，是生物圖鑑可以延伸的方向。',
    observations: ['觀察游動、浮出水面與互動，不用一次短暫觀察判定健康。', '閱讀聲學解說，分清發聲、聽覺與回聲定位的概念。', '將動物展示與照護、研究一起理解，遵守現場觀察規範。'],
    question: '人依賴視覺的習慣，是否會限制我們理解其他動物的感官世界？',
    source: { title: '海生館：發現貝魯卡與白鯨聲學介紹（館訊PDF）', url: 'https://ws.nmmba.gov.tw/Download.ashx?icon=.pdf&n=OTfmnJ%2FppKjoqIotUDMyLTMzIOOAjOeZvOePvuKAp%2Biynemtr%2BWNoeOAjeeZvemvqOWxleimveS7i%2Be0uS5wZGY%3D&u=LzAwMS9VcGxvYWQvMjIzL3JlbGZpbGUvNjYzOC85OTY2LzIwYWFkMzNjLWE1MGYtNDljZS1iYTViLTg2OGI1M2ZiMGI3Ni5wZGY%3D' },
  },
  {
    subjectType: 'animal', museum: 'okinawa-churaumi', venue: '沖繩美麗海水族館', title: '鯨鯊：黑潮之海的觀察入口', category: '生命與化石', era: '現生魚類',
    image: '/assets/atlas-whaleshark-3d-aged-v2.webp', imageKind: 'illustration', imageNote: 'AI 鯨鯊概念插畫，3D造型搭配仿舊相紙色調；非歷史或現場照片，細節不可作物種鑑定依據。',
    relationship: '館方生物圖鑑主題；鯨鯊是魚類，不是鯨類。2026/10/26 查核時官網維護中，非即時展況。',
    introduction: '鯨鯊的名字容易讓人聯想到鯨，但它屬於魚類。可以從鰓、尾部與游動方式開始觀察，再回到館方圖鑑核對分類與生活環境。',
    observations: ['找身體兩側的鰓裂，與哺乳類的呼吸方式比較。', '看斑點與身體輪廓，辨認可觀察的外形特徵。', '分開閱讀物種知識與館內個體資訊，不推測當日餵食或展示。'],
    question: '名字相似的動物，分類與生理特徵可能差很多。',
    source: { title: '美麗海水族館：鯨鯊生物圖鑑', url: 'https://churaumi.okinawa/fishbook/00000510/' },
    extension: { title: '日本農林水產省：鯨鯊介紹與館方資料連結', url: 'https://www.maff.go.jp/j/heya/kodomo_sodan/0106/01.html' },
  },
  {
    subjectType: 'fossil', museum: 'penghu-fossil', venue: '澎湖化石館', title: '潘氏澎湖鱷', category: '生命與化石', era: '中新世；約1500～1700萬年前',
    image: '/assets/atlas-crocodile.webp', imageKind: 'illustration', imageNote: 'AI 古鱷骨架概念插畫；非潘氏澎湖鱷的精確復原，骨骼排列與補配範圍請看館方資料。',
    relationship: '館方重點展示的古脊椎動物化石；不是恐龍。',
    introduction: '館方以潘氏澎湖鱷介紹澎湖的遠古生命。除了看長吻與骨架，也值得追問出土地層、保存狀態與復原過程如何共同形成我們看到的樣貌。',
    observations: ['比較頭骨、脊椎與鱗甲，思考不同部位的功能。', '區分原有化石、支架及補配，不把完整展示等同所有骨骼都出土。', '把標本放回地質時間，不與更新世的澎湖水道動物群混為一談。'],
    question: '化石展示像一項推理：哪些部分是直接證據，哪些需要比較與重建？',
    source: { title: '澎湖縣文化局：澎湖化石館', url: 'https://www.penghu.gov.tw/phhcc/home.jsp?id=115' },
  },
  {
    subjectType: 'fossil', museum: 'zuojhen-fossil', venue: '臺南左鎮化石園區', title: '早坂中國犀', category: '生命與化石', era: '更新世',
    image: '/assets/atlas-rhino.webp', imageKind: 'illustration', imageNote: 'AI 犀牛骨架概念插畫；非早坂中國犀標本的精確重建，不能據圖判定解剖細節。',
    relationship: '園區數位典藏收錄的犀牛化石；中文名稱依館方條目。',
    introduction: '菜寮溪流域的犀牛化石，讓人重新想像臺灣曾有的動物群。從骨架到挖掘紀錄，化石不只說明動物長什麼樣，也記錄它如何被發現與研究。',
    observations: ['看牙齒、四肢與腳端，不只注意頭上的角。', '閱讀原地埋藏與溪床拾得的差別：出土位置會影響可推論的資訊。', '把展示骨架與實際出土完整度分開，不把補配部分當直接證據。'],
    question: '延伸到奇蹄與偶蹄：分類不是只數看得到的腳趾，也要看承重軸線與親緣。',
    source: { title: '左鎮典藏：犀牛左上臼齒P4（早坂中國犀）', url: 'https://fossil.tnc.gov.tw/fossil/index-1.php?id=14&m2=31&sid=1' },
    extension: { title: '館方：早坂中國犀的發掘與保存', url: 'https://fossil.tnc.gov.tw/form/index-1.php?id=42&m2=30' },
  },
  {
    subjectType: 'architecture', museum: 'ntt', venue: '臺中國家歌劇院', title: '曲牆與美聲涵洞', category: '建築', era: '當代劇場建築',
    image: '/assets/atlas-theater.webp', imageKind: 'illustration', imageNote: 'AI 曲牆劇場建築概念插畫；非歌劇院的精確模型，空間與結構僅為意象。',
    relationship: '以場館本身為觀察對象，不列作館藏。',
    introduction: '伊東豊雄設計的歌劇院，以連續曲面組織空間。建築可以像一件大型展品，從外觀、動線與結構去閱讀；看表演之外，也能看一座劇場如何成立。',
    observations: ['從外牆的開口，觀察曲面如何向室內延伸。', '在開放區域比較光線、視線與行走方向的變化。', '區分公共空間與須購票或預約的區域，依場館規範參觀。'],
    question: '當牆不只是隔間，也成為空間形狀的一部分，人的移動會如何改變？',
    source: { title: '歌劇院：場館導覽', url: 'https://www.npac-ntt.org/tour/t1-1.html' },
  },
];

export function atlasEntryFor(museum: string | null): AtlasEntry {
  return atlasEntries.find((entry) => entry.museum === museum) ?? atlasEntries[0]!;
}
