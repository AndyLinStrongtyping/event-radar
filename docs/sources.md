# 博物館來源盤點（2026-10-04）

| 優先 | 館別 | 官方入口 | 取得狀態 | 理由 |
| --- | --- | --- | --- | --- |
| 1 | 奇美博物館（臺南） | https://www.chimeimuseum.org/index.php/exhibition-event | 官網有特展頁及供奇美官網前端使用的內部資料呼叫；未找到對外公開的 API 文件或再利用授權。目前只有人工核對的一筆資料，尚未自動同步 | 使用者指定，國際特展有明確展期與票價 |
| 1 | 國立自然科學博物館（臺中） | https://data.gov.tw/dataset/7499 | 政府資料開放平臺提供可讀 JSON 特展資源；個人 API key 另候審查 | 科學與自然類特展 |
| 1 | 國立臺灣博物館（臺北） | https://www.ntm.gov.tw/ | 官方展覽頁已找到，API 待查 | 自然、人文、建築等展覽 |
| 1 | 國立故宮博物院北部院區（臺北） | https://www.npm.gov.tw/ | 官網展覽頁已找到，API 待查 | 可在下一階段擴充多場館資料模型 |
| 1 | 國立故宮博物院南部院區（嘉義） | https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3112 | 當期與預告官方頁已接入本機匯入；不是公開 API，線上排程尚未啟用 | 展名、展期、展廳與官方詳情連結可直接核對 |
| 1 | 國立臺灣歷史博物館（臺南） | https://www.nmth.gov.tw/default.aspx | 官網已找到，API 待查 | 臺灣史主題 |
| 2 | 國立科學工藝博物館（高雄） | https://www.nstm.gov.tw/ | 官網展覽頁已找到，API 待查 | 科學技術類與南部覆蓋 |
| 2 | 國立臺灣科學教育館（臺北） | https://www.ntsec.gov.tw/ | 官網常設展與特展頁已找到，API 待查 | 人體、生態、物質科學與科技教育 |
| 2 | 國立臺灣美術館（臺中） | https://www.ntmofa.gov.tw/ | 官網當期展覽頁已找到，API 待查 | 美術類與中部覆蓋 |
| 2 | 臺南市美術館（臺南） | https://www.tnam.museum/ | 官網展覽頁已找到，API 待查 | 美術類與在地覆蓋 |

盤點狀態只說明資料入口存在，**不代表**取得許可、API 可用或已自動擷取。優先順序依產品題材與地域平衡，不以館所價值排名。

### 奇美特展來源查證（2026-10-04）

- [官方特展列表](https://www.chimeimuseum.org/index.php/exhibition-event)公開顯示展名、簡介、展期與展覽連結。頁面程式會向官網自己的 `/exhibition-event/api` 發送帶 CSRF token 的 POST 請求；這是官網內部資料呼叫，不能據此稱為提供第三方使用的公開 API。
- 官網 `robots.txt` 只列出 `/weyacms/` 與 `/admin/` 禁止擷取；robots 規則不是內容再利用授權。[主站著作權與隱私權頁](https://www.chimeimuseum.org/privacy)也未提供特展資料的開放授權或 API 條款。線上商店的使用條款適用於不同網域，不應直接當成主站特展資料條款。
- 因此目前不依賴內部端點建置每日同步。先維持有官方連結、最後核對時間的人工資料；下一步向館方確認是否提供正式資料介接或再利用方式。若採公開頁面定期讀取，也須先確認可接受的方式，僅保存必要欄位，遇格式變動時停止更新並標記過期。
- 2026-10-04 再核對：`/exhibition-event` 與 `/index.php/exhibition-event` 都是官方特展頁，但初始 HTML 的展覽卡是前端模板（例如 `${item.title}`），單純定期下載該頁無法可靠取得完整展覽清單。可先規劃每週一次的低頻變更檢查，供人工核對新特展；正式自動匯入仍取決於可持續且可接受的資料取得方式。Event Radar v0.1 僅收特展，音樂節、工作坊與售票名額不混入特展資料。
- 變更檢查若日後實作，應使用可辨識的 User-Agent、遵守 `robots.txt` 與伺服器回應，限制請求數及逾時；不以冒充 Chrome 標頭或固定延遲作為取得資料的保證。這也不表示奇美特展已啟用自動同步。

## 常設展靜態導覽的依據

首頁的常設展頁面由人工撰寫，不計入上表的特展資料取得狀態。臺博館頁依[「博物臺灣」館方介紹](https://www.ntm.gov.tw/News_Content.aspx?n=5651&s=147780)整理自然臺灣、浮生臺灣兩個展廳；臺史博頁依[官方線上常設展](https://the.nmth.gov.tw/nmth/zh-TW/Home/PermanentExhibition)整理閱讀路線。兩館特展尚未匯入資料庫，頁面因此連回館方查最新展覽。

科博館導覽的植物園段落依[植物園官方介紹](https://www.nmns.edu.tw/ch/exhibitions/galleries/botanical-garden/index.html)與[亞馬遜河魚展示](https://www.nmns.edu.tw/ch/exhibitions/galleries/botanical-garden/amazonslargestfish/)撰寫；館方目前列有食人魚。[箭毒蛙展示的館方專文](https://www.nmns.edu.tw/ch/exhibitions/galleries/botanical-garden/flowers/Theme-F00608/)發表已久，因此頁面明確提醒是否仍展出要以當日公告為準。故宮南院導覽依[亞洲茶文化](https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=9963f5e2-df38-4cb3-bfdf-b689c14ca3f7)、[佛教藝術](https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=be0bda12-a244-4702-9c92-059f13f33c3b)與[亞洲織品展](https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=176c8367-b382-40d9-a462-412f512e97cf&State=&appname=)的館方說明整理；織品展件與展名可能輪替。南院有明確起訖日期的展覽已由官方頁匯入本機資料庫，開放式常設展廳仍只保留在人工導覽。

科工館導覽依官方[動力與機械](https://www.nstm.gov.tw/Exhibition.aspx?KeyID=e0da1041-aee2-4627-b98a-13c78c9f0b68)、[電信@臺灣](https://www.nstm.gov.tw/Exhibition.aspx?KeyID=422a9a67-5ad4-460b-9e01-7633be54ebcf)及[臺灣工業史蹟廳](https://www.nstm.gov.tw/Exhibition.aspx?KeyID=0d760d96-a968-4791-9d54-4d0109f7a286)整理。科教館導覽依官方[常設展列表](https://www.ntsec.gov.tw/article/list.aspx?a=27)選取 3–6 樓的[人體奧妙](https://www.ntsec.gov.tw/article/detail.aspx?a=5106)、[生物多樣性](https://www.ntsec.gov.tw/article/detail.aspx?a=78)、[物質科學](https://www.ntsec.gov.tw/article/detail.aspx?a=64)與[半導體未來館](https://www.ntsec.gov.tw/article/detail.aspx?a=5117)。兩館導覽都是人工靜態內容，兩館近期特展尚未匯入資料庫。

## 常設展特色線索的依據

各館「發掘線索」是人工撰寫的閱讀提示，不代表即時展件清單。科博館的男性木乃伊、人型棺柩與恐龍展示依[生命科學廳介紹](https://www.nmns.edu.tw/ch/exhibitions/galleries/life-science-hall/index.html)；奇美自動樂器依[館方常設展特色說明](https://www.chimeimuseum.org/index.php/about/60bdefeb8188c)；臺博館《康熙臺灣輿圖》數位重建版與早坂犀牛復原模型依[館方「博物臺灣」介紹](https://www.ntm.gov.tw/News_Content.aspx?n=5651&s=147780)。

臺史博常設展中的錢幣依[館方數位資源](https://taiwanindex.nmth.gov.tw/theme/detail/77)；故宮南院單柄壺依[東亞茶文化展介紹](https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=9963f5e2-df38-4cb3-bfdf-b689c14ca3f7)，展件可能輪替；科工館磁石電話機與交換機依[電信@臺灣](https://www.nstm.gov.tw/Exhibition.aspx?KeyID=422a9a67-5ad4-460b-9e01-7633be54ebcf)；科教館 P5000 設備依[館方展覽資訊](https://www.ntsec.gov.tw/article/detail.aspx?a=6014&print=1)。模型、數位重建與展示設備在頁面中明確標示，不當成原始出土文物。

## 交通規劃的依據與界線

七館導覽的交通提示與目的地依各館官方資訊核對：[奇美](https://www.chimeimuseum.org/index.php/visit)、[科博館](https://www.nmns.edu.tw/ch/visit/traffic/)、[臺博館](https://www.ntm.gov.tw/cp.aspx?Create=1&n=5459)、[臺史博](https://www.nmth.gov.tw/cp.aspx?Create=1&n=4101)、[故宮南院](https://south.npm.gov.tw/FAQDetailC005400.aspx?Cond=6994b5f5-ccd6-48b3-bdb2-5449457e8bc9)、[科工館](https://www.nstm.gov.tw/Reference/VisitorInformation/TrafficInfo.htm)及[科教館](https://www.ntsec.gov.tw/article/detail.aspx?a=22)。路線連結使用 [Google Maps URLs 官方格式](https://developers.google.com/maps/documentation/urls/get-started)，不需 API key。選縣市但未提供確切起點時，使用該縣市政府作示意；真實路線、班次、費用與時間由地圖服務及交通業者決定，本站不宣稱能選出最適合的交通方式。

## 中央平台評估

- [文化部「展覽資訊」資料集](https://data.gov.tw/dataset/6012)：比「藝文活動所有類別」更貼近本產品，含展名、展期、場地及來源名稱，採政府資料開放授權條款第 1 版，更新頻率每日。可作第二條自動來源，但需確認館所覆蓋率及同展重複紀錄。
- [國家文化記憶庫 OpenAPI](https://tcmb.culture.tw/zh-tw/OpenApi)：個別客製化欄位需申請 API key；其開放資料集描述偏文化素材與圖像，暫不當作當期特展檔期主來源。
- 典藏圖片、文物與古蹟清單不等於展覽檔期，故宮與臺史博典藏 Open Data 不能直接替代特展來源。
