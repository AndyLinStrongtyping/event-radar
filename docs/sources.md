# 博物館來源盤點（2026-10-04）

| 優先 | 館別 | 官方入口 | 取得狀態 | 理由 |
| --- | --- | --- | --- | --- |
| 1 | 奇美博物館（臺南） | https://www.chimeimuseum.org/index.php/exhibition-event | 官網有特展頁，未找到公開 API 文件；先人工整理，待確認正式取得方式 | 使用者指定，國際特展有明確展期與票價 |
| 1 | 國立自然科學博物館（臺中） | https://data.gov.tw/dataset/7499 | 政府資料開放平臺提供可讀 JSON 特展資源；個人 API key 另候審查 | 科學與自然類特展 |
| 1 | 國立臺灣博物館（臺北） | https://www.ntm.gov.tw/ | 官方展覽頁已找到，API 待查 | 自然、人文、建築等展覽 |
| 1 | 國立故宮博物院（臺北／嘉義） | https://www.npm.gov.tw/ | 官網展覽頁已找到，API 待查 | 南北院區可測多場館資料模型 |
| 1 | 國立臺灣歷史博物館（臺南） | https://www.nmth.gov.tw/default.aspx | 官網已找到，API 待查 | 臺灣史主題 |
| 2 | 國立科學工藝博物館（高雄） | https://www.nstm.gov.tw/ | 官網展覽頁已找到，API 待查 | 科學技術類與南部覆蓋 |
| 2 | 國立臺灣美術館（臺中） | https://www.ntmofa.gov.tw/ | 官網當期展覽頁已找到，API 待查 | 美術類與中部覆蓋 |
| 2 | 臺南市美術館（臺南） | https://www.tnam.museum/ | 官網展覽頁已找到，API 待查 | 美術類與在地覆蓋 |

盤點狀態只說明資料入口存在，**不代表**取得許可、API 可用或已自動擷取。優先順序依產品題材與地域平衡，不以館所價值排名。

## 常設展靜態導覽的依據

首頁的常設展頁面由人工撰寫，不計入上表的特展資料取得狀態。臺博館頁依[「博物臺灣」館方介紹](https://www.ntm.gov.tw/News_Content.aspx?n=5651&s=147780)整理自然臺灣、浮生臺灣兩個展廳；臺史博頁依[官方線上常設展](https://the.nmth.gov.tw/nmth/zh-TW/Home/PermanentExhibition)整理閱讀路線。兩館特展尚未匯入資料庫，頁面因此連回館方查最新展覽。

科博館導覽的植物園段落依[植物園官方介紹](https://www.nmns.edu.tw/ch/exhibitions/galleries/botanical-garden/index.html)與[亞馬遜河魚展示](https://www.nmns.edu.tw/ch/exhibitions/galleries/botanical-garden/amazonslargestfish/)撰寫；館方目前列有食人魚。[箭毒蛙展示的館方專文](https://www.nmns.edu.tw/ch/exhibitions/galleries/botanical-garden/flowers/Theme-F00608/)發表已久，因此頁面明確提醒是否仍展出要以當日公告為準。故宮南院導覽依[亞洲茶文化](https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=9963f5e2-df38-4cb3-bfdf-b689c14ca3f7)、[佛教藝術](https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=be0bda12-a244-4702-9c92-059f13f33c3b)與[亞洲織品展](https://south.npm.gov.tw/ExhibitionsDetailC003110.aspx?Cond=176c8367-b382-40d9-a462-412f512e97cf&State=&appname=)的館方說明整理；織品展件與展名可能輪替。故宮南院特展尚未匯入資料庫。

## 中央平台評估

- [文化部「展覽資訊」資料集](https://data.gov.tw/dataset/6012)：比「藝文活動所有類別」更貼近本產品，含展名、展期、場地及來源名稱，採政府資料開放授權條款第 1 版，更新頻率每日。可作第二條自動來源，但需確認館所覆蓋率及同展重複紀錄。
- [國家文化記憶庫 OpenAPI](https://tcmb.culture.tw/zh-tw/OpenApi)：個別客製化欄位需申請 API key；其開放資料集描述偏文化素材與圖像，暫不當作當期特展檔期主來源。
- 典藏圖片、文物與古蹟清單不等於展覽檔期，故宮與臺史博典藏 Open Data 不能直接替代特展來源。
