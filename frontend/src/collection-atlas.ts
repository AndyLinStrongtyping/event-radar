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
    introduction: "這口鐘留下的，不只有聲音，還有西周的文字。鐘身上的銘文記下了當時的事件；今天讀它，有點像翻開一份鑄在青銅上的歷史紀錄。",
    observations: ["鐘頂的懸掛結構，透露了它原本怎麼被吊起來。","紋飾和銘文各有位置，一面是裝飾，一面留下了文字紀錄。","館方藏品頁有銘文釋讀，對著看，比只看器形多了不少故事。"],
    question: "這些字能留到今天，連保存本身都是故事的一部分。",
    source: { title: '故宮數位典藏：宗周鐘', url: 'https://digitalarchive.npm.gov.tw/Collection/Detail/1464?dep=U' },
  },
  {
    subjectType: 'object', museum: 'npm-south', venue: '故宮南院', title: '唐代長沙窯綠釉單柄壺', category: '器物與歷史', era: '唐代',
    image: '/assets/atlas-ewer.webp', imageKind: 'illustration', imageNote: 'AI 單柄陶壺概念插畫；釉色、比例與細節非該件文物重建。',
    relationship: '館方觀光導覽手冊收錄的茶文化展品；不保證當日出展。',
    introduction: "喝茶這件日常小事，古人用的工具卻跟我們不太一樣。南院的茶文化導覽收錄了這把唐代單柄壺，和茶盞、盞托一起看，就像在認識一套當時的茶桌配備。",
    observations: ["壺嘴和把手的位置，會影響拿起來順不順手、倒水穩不穩。","釉色到了器身下方怎麼收尾，也是陶壺很耐看的細節。","不同年代的茶具放在一起，喝茶方式的變化就比較容易看出來。"],
    question: "我們熟悉的整葉沖泡，並不是每個時代的喝茶方式。茶怎麼處理，桌上的工具也跟著換。",
    source: { title: '故宮南院：中文觀光導覽手冊（PDF）', url: 'https://south.npm.gov.tw/Uploads/files/故宮好客中文觀光導覽手冊.pdf' },
  },
  {
    subjectType: 'object', museum: 'chimei', venue: '奇美博物館', title: '機械音樂家：自動樂器', category: '藝術與聲音', era: '機械音樂與聲音技術',
    image: '/assets/atlas-music.webp', imageKind: 'illustration', imageNote: 'AI 滾筒風琴題材插畫；非奇美某一件樂器的實物圖。',
    relationship: '取自館方「機械音樂家」展區主題，非單一藏品清冊。',
    introduction: "眼前沒有人演奏，樂器卻自己唱起來了。奇美的音樂盒、滾筒風琴等自動樂器，把旋律藏進機械裡；機關一轉，就能把事先安排好的音樂播放出來。",
    observations: ["保存旋律的機關，和真正發聲的部分，可能藏在不同位置。","動力一路帶動機關，最後變成聲音，過程本身就很好看。","碰上館方演示時，可以一邊聽、一邊找正在動的零件。演示時間以公告為準。"],
    question: "今天按一下手機就能播歌，這些機械樂器則讓「播放音樂」的過程直接攤在眼前。",
    source: { title: '奇美：機械音樂家', url: 'https://www.chimeimuseum.org/permanent-exhibition/604effb1e6e0b' },
  },
  {
    subjectType: 'object', museum: 'nmns', venue: '國立自然科學博物館', title: '古埃及木乃伊與人型棺柩', category: '器物與歷史', era: '古埃及；年代以現場標示為準',
    image: '/assets/atlas-mummy.webp', imageKind: 'illustration', imageNote: 'AI 木乃伊與人型棺概念插畫；非科博館實物，包裹、彩繪與比例不可作考證依據。',
    relationship: '科博館生命科學廳介紹的古埃及展示。',
    introduction: "木乃伊讓人好奇的，是古埃及人怎麼看待死亡，又怎麼保存身體。科博館透過男性木乃伊、人型棺柩與影像介紹這些故事；眼前的遺體，也曾是一個真實生活過的人。",
    observations: ["包裹材料、棺柩和展示裝置，分別屬於不同的製作與保存階段。","棺上的圖像與文字，和身分、死後世界的想像有關。","館方的研究與保存說明，能補上外觀無法告訴我們的事。"],
    question: "這裡有兩段相隔很久的故事：古人如何保存身體，以及今天的人如何研究、照顧這些遺存。",
    source: { title: '科博館：生命科學廳', url: 'https://www.nmns.edu.tw/ch/exhibitions/galleries/life-science-hall/index.html' },
  },
  {
    subjectType: 'object', museum: 'ntm', venue: '國立臺灣博物館', title: '康熙臺灣輿圖', category: '器物與歷史', era: '清代；17、18世紀之際的臺灣圖像',
    image: '/assets/atlas-map.webp', imageKind: 'illustration', imageNote: 'AI 古地圖題材插畫；地形與文字並非臺灣實際地理或原圖內容，不可作地圖使用。',
    relationship: '臺博館典藏與數位介紹；原件、摹本及數位版本須分開辨識。',
    introduction: "這幅長卷裡，山川、聚落和生活景象擠在同一張圖上。它和手機地圖很不一樣：除了地點，還能看到當時的人怎麼描繪、認識臺灣。",
    observations: ["官方數位圖可以慢慢放大，找山、河與聚落各自的畫法。","和今天的地圖對著看，方向與距離的安排很有意思。","原件、摹本與數位重建各有版本，展場標示會說明眼前的是哪一種。"],
    question: "同一塊土地，換個年代就有不同的畫法。古地圖裡那些被特別畫出來的地方，很值得多停一下。",
    source: { title: '臺博館：康熙臺灣輿圖數位專題', url: 'https://kangxitaiwanmap.ntm.gov.tw/' },
  },
  {
    subjectType: 'object', museum: 'nmth', venue: '國立臺灣歷史博物館', title: '流通錢幣與臺灣的世界連結', category: '器物與歷史', era: '17～19世紀',
    image: '/assets/atlas-coins.webp', imageKind: 'illustration', imageNote: 'AI 歷史錢幣題材插畫；非臺灣流通幣種或館藏錢幣的精確重製。',
    relationship: '依館方臺灣錢幣研究主題整理，不是單件藏品或現展清單。',
    introduction: "小小一枚錢，可能走過很遠的路。臺史博以17～19世紀來到臺灣的不同錢幣，聊當時的交易與往來；材質、形狀和上面的文字，都留下了線索。",
    observations: ["有沒有孔、孔是圓是方，連邊緣和字樣都各有差別。","幣種與年代對上後，就能接著看它怎麼來到臺灣。","一種錢幣曾在哪裡流通，和館藏這一枚從哪裡來，是兩段不同的故事。"],
    question: "拿今天口袋裡的零錢來想也很有趣：幾百年後的人，會從上面的圖案讀出什麼？",
    source: { title: '臺史博：臺灣錢幣．世界脈動', url: 'https://taiwanindex.nmth.gov.tw/theme/detail/77' },
  },
  {
    subjectType: 'object', museum: 'nstm', venue: '國立科學工藝博物館', title: '磁石式電話交換機', category: '科學與技術', era: '人工交換的通訊年代',
    image: '/assets/atlas-switchboard.webp', imageKind: 'illustration', imageNote: 'AI 人工電話交換機概念插畫；非館方指定機型，不代表實際線路與操作構造。',
    relationship: '館方「電信＠臺灣」展覽介紹的人工交換設備。',
    introduction: "以前打電話，還得有人幫忙「接線」。手搖電話先呼叫接線生，再由接線生接通線路。科工館這類交換設備上密密麻麻的插孔與塞繩，就是當年一通通電話的中轉站。",
    observations: ["插孔、塞繩和呼叫指示，各自負責通話流程的一部分。","通知有人要通話，和真正接通通話線路，是不同的步驟。","接線生得在一堆線路之間處理呼叫，機器背後也有人的忙碌日常。"],
    question: "今天撥號幾乎感覺不到中間的過程。站在交換機前，才比較容易想像以前接一通電話有多忙。",
    source: { title: '科工館：電信＠臺灣', url: 'https://www.nstm.gov.tw/Exhibition.aspx?KeyID=422a9a67-5ad4-460b-9e01-7633be54ebcf' },
  },
  {
    subjectType: 'object', museum: 'ntsec', venue: '國立臺灣科學教育館', title: '半導體製造設備與晶片', category: '科學與技術', era: '現代半導體技術',
    image: '/assets/atlas-chip.webp', imageKind: 'illustration', imageNote: 'AI 半導體設備概念插畫；不代表任何機型的正確構造或操作方式。',
    relationship: '以「半導體未來館」的製造與分工主題為入口，非古文物。',
    introduction: "晶片很小，做出它的陣仗可不小。科教館的半導體未來館，從物料、製造到實驗室慢慢拆開介紹，看看這個常出現在新聞裡的產業，到底在忙些什麼。",
    observations: ["原料、製造設備和完成的晶片，放在一起就像一條縮小版生產線。","材料怎麼選、製作條件怎麼控制，都是晶片製造的一部分。","每個環節需要不同專業，一枚晶片其實是很多人合作的成果。"],
    question: "成品小到不容易看清，背後卻需要一整套精密設備與流程。這個大小反差，本身就很有看頭。",
    source: { title: '科教館：半導體未來館', url: 'https://www.ntsec.gov.tw/article/detail.aspx?a=5117' },
  },
  {
    subjectType: 'object', museum: 'ntmofa', venue: '國立臺灣美術館', title: '黃土水《水牛群像》', category: '藝術與聲音', era: '原作1930年；館藏為青銅翻製品',
    image: '/assets/atlas-buffalo.webp', imageKind: 'illustration', imageNote: 'AI 水牛浮雕題材概念插畫；非黃土水作品的構圖重製，不可據此辨認原作細節。',
    relationship: '國美館典藏青銅翻製品；石膏原作位於臺北中山堂。',
    introduction: "牧童和水牛，讓一面浮雕有了臺灣農村的生活感。國美館收藏的是青銅翻製品，1930年的石膏原作則在臺北中山堂；同一件創作，也有不同材質的相遇方式。",
    observations: ["人物、牛隻與植物彼此重疊，畫面就有了前後層次。","換個位置看，浮雕的凹凸會隨光影變得更明顯。","國美館的是青銅版本，中山堂的是石膏原作，兩處可以接著看。"],
    question: "下次經過臺北中山堂，也可以接著找石膏原作。同一個構圖換了材質，看起來會有什麼不同？",
    source: { title: '文化部典藏網：國美館水牛群像', url: 'https://collections.culture.tw/Object?RNO=MDc4MDAxNjE%3D&SYSUID=12' },
    extension: { title: '臺北市文化小旅行：中山堂與石膏原作', url: 'https://miniculturaltrips.gov.taipei/News_Content.aspx?n=0E170AD95646630E&s=97BED5754F37D338&sms=DC4BFB02CE861520' },
  },
  {
    subjectType: 'animal', museum: 'nmmba', venue: '國立海洋生物博物館', title: '白鯨：用聲音認識環境', category: '生命與化石', era: '現生海洋哺乳動物',
    image: '/assets/atlas-beluga-3d-aged-v2.webp', imageKind: 'illustration', imageNote: 'AI 白鯨概念插畫，3D造型搭配仿舊相紙色調；非歷史或現場照片，比例與表情為藝術化呈現。',
    relationship: '海生館的白鯨介紹；現場個體與節目請看館方公告。',
    introduction: "看白鯨游過來，很容易先注意到牠的外形。不過，聲音也是認識牠的好入口。海生館的介紹談到白鯨的聲音、聽覺與行為，讓我們知道牠怎麼感受周遭的水中世界。",
    observations: ["游動、換氣、和同伴互動，慢慢看會遇到不同的小動作。","發出聲音、聽見聲音、利用回聲定位，彼此有關，卻是不同的事。","館方的照護與研究介紹，能補上隔著玻璃看不到的日常。"],
    question: "我們常用「看見什麼」認識環境。換成白鯨，聲音又會帶來怎樣的世界？",
    source: { title: '海生館：發現貝魯卡與白鯨聲學介紹（館訊PDF）', url: 'https://ws.nmmba.gov.tw/Download.ashx?icon=.pdf&n=OTfmnJ%2FppKjoqIotUDMyLTMzIOOAjOeZvOePvuKAp%2Biynemtr%2BWNoeOAjeeZvemvqOWxleimveS7i%2Be0uS5wZGY%3D&u=LzAwMS9VcGxvYWQvMjIzL3JlbGZpbGUvNjYzOC85OTY2LzIwYWFkMzNjLWE1MGYtNDljZS1iYTViLTg2OGI1M2ZiMGI3Ni5wZGY%3D' },
  },
  {
    subjectType: 'animal', museum: 'okinawa-churaumi', venue: '沖繩美麗海水族館', title: '鯨鯊：黑潮之海的觀察入口', category: '生命與化石', era: '現生魚類',
    image: '/assets/atlas-whaleshark-3d-aged-v2.webp', imageKind: 'illustration', imageNote: 'AI 鯨鯊概念插畫，3D造型搭配仿舊相紙色調；非歷史或現場照片，細節不可作物種鑑定依據。',
    relationship: '館方生物圖鑑主題；鯨鯊是魚類，不是鯨類。2026/10/26 查核時官網維護中，非即時展況。',
    introduction: "名字裡有個「鯨」，鯨鯊卻是魚類。看牠身體兩側的鰓裂，再和白鯨比一比，就能發現兩種大型海洋動物其實很不一樣。",
    observations: ["身體兩側的鰓裂，是和鯨類很不一樣的地方。","斑點、身體輪廓和游動的樣子，都值得慢慢看。","館方生物圖鑑介紹的是物種；當天能看到哪些個體、有哪些節目，則看現場公告。"],
    question: "名字真的會讓人誤會：鯨鯊是魚，白鯨是哺乳動物，住在水裡也不一定是同一類。",
    source: { title: '美麗海水族館：鯨鯊生物圖鑑', url: 'https://churaumi.okinawa/fishbook/00000510/' },
    extension: { title: '日本農林水產省：鯨鯊介紹與館方資料連結', url: 'https://www.maff.go.jp/j/heya/kodomo_sodan/0106/01.html' },
  },
  {
    subjectType: 'fossil', museum: 'penghu-fossil', venue: '澎湖化石館', title: '潘氏澎湖鱷', category: '生命與化石', era: '中新世；約1500～1700萬年前',
    image: '/assets/atlas-crocodile.webp', imageKind: 'illustration', imageNote: 'AI 古鱷骨架概念插畫；非潘氏澎湖鱷的精確復原，骨骼排列與補配範圍請看館方資料。',
    relationship: '館方重點展示的古脊椎動物化石；不是恐龍。',
    introduction: "第一眼很難不注意到那張長嘴。潘氏澎湖鱷是澎湖化石館的重點展示，生活在中新世，和後來更新世的澎湖水道動物群相隔很久。眼前的骨架，也包含發掘、保存與復原的故事。",
    observations: ["長吻、脊椎和鱗甲，各自透露了身體不同部位的樣貌。","完整的展示骨架，可能包含支架與補配；哪些是真正出土的化石，可以對照館方說明。","把時間拉回中新世，就比較容易想像牠和其他澎湖化石之間的年代差距。"],
    question: "一副骨架看起來很完整，卻未必每根骨頭都一起出土。展場裡的復原說明，常常和化石本身一樣精彩。",
    source: { title: '澎湖縣文化局：澎湖化石館', url: 'https://www.penghu.gov.tw/phhcc/home.jsp?id=115' },
  },
  {
    subjectType: 'fossil', museum: 'zuojhen-fossil', venue: '臺南左鎮化石園區', title: '早坂中國犀', category: '生命與化石', era: '更新世',
    image: '/assets/atlas-rhino.webp', imageKind: 'illustration', imageNote: 'AI 犀牛骨架概念插畫；非早坂中國犀標本的精確重建，不能據圖判定解剖細節。',
    relationship: '園區數位典藏收錄的犀牛化石；中文名稱依館方條目。',
    introduction: "今天在臺灣野外看不到犀牛，菜寮溪流域卻留下了牠們的化石。早坂中國犀的故事，從牙齒、骨骼一路聊到挖掘紀錄，讓人想像很久以前這片土地上的動物。",
    observations: ["除了頭上的角，牙齒、四肢和腳端也很有看頭。","溪床撿到的化石，和保留原地埋藏位置的化石，能告訴研究者的事情不太一樣。","展示骨架哪些部分出土、哪些部分補配，館方的發掘紀錄能接著說下去。"],
    question: "犀牛屬於奇蹄類，鹿則屬於偶蹄類。這名字很好記，但分類還得看承重軸線與親緣，貘的前足甚至有四趾。",
    source: { title: '左鎮典藏：犀牛左上臼齒P4（早坂中國犀）', url: 'https://fossil.tnc.gov.tw/fossil/index-1.php?id=14&m2=31&sid=1' },
    extension: { title: '館方：早坂中國犀的發掘與保存', url: 'https://fossil.tnc.gov.tw/form/index-1.php?id=42&m2=30' },
  },
  {
    subjectType: 'architecture', museum: 'ntt', venue: '臺中國家歌劇院', title: '曲牆與美聲涵洞', category: '建築', era: '當代劇場建築',
    image: '/assets/atlas-theater.webp', imageKind: 'illustration', imageNote: 'AI 曲牆劇場建築概念插畫；非歌劇院的精確模型，空間與結構僅為意象。',
    relationship: '以場館本身為觀察對象，不列作館藏。',
    introduction: "就算今天沒買表演票，歌劇院的建築也很值得逛。伊東豊雄設計的連續曲面，讓牆面和空間連在一起；繞著走，光線、視線和眼前的形狀也一直在變。",
    observations: ["外牆的開口和室內曲面，像是接續著同一段形狀。","在開放區域換個位置，同一面曲牆就會呈現不同樣貌。","公共空間可以依開放規定參觀，劇場及部分區域則需要購票或預約。"],
    question: "這裡很適合慢慢走一圈。同一個地方，站著看和沿著曲牆移動，感覺會不太一樣。",
    source: { title: '歌劇院：場館導覽', url: 'https://www.npac-ntt.org/tour/t1-1.html' },
  },
];

export function atlasEntryFor(museum: string | null): AtlasEntry {
  return atlasEntries.find((entry) => entry.museum === museum) ?? atlasEntries[0]!;
}
