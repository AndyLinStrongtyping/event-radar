# 票價與購票入口｜人工核對資料

最後人工核對：2026-10-10。網站仍是本機 MVP；這份票務索引**不會隨展覽每日匯入自動更新**。實際價格、身分優惠、購票日期、名額、休館與是否須另外購買特展票，一律以館方頁面及售票頁為準。

| 館所 | 索引顯示範圍 | 官方票價／售票證據 |
| --- | --- | --- |
| 奇美博物館 | 常設展全票 NT$200 | [館方參觀指南](https://www.chimeimuseum.org/visit)；館方連至 [Fonticket](https://chimeimuseum.fonticket.com/) |
| 國立自然科學博物館 | 展示場全票 NT$120 | [館方票價](https://www.nmns.edu.tw/ch/visit/ticket/index.html)；館方連至 [iTicket](https://iticket.nmns.edu.tw/iticket/)；收費特展另計 |
| 國立臺灣博物館 | 本館／古生物館全票 NT$30 | [館方開放時間與票價](https://www.ntm.gov.tw/cp.aspx?Create=1&n=5444)；依館方說明現場購票 |
| 國立臺灣歷史博物館 | 一般入館全票 NT$100 | [館方常見問題](https://the.nmth.gov.tw/nmth/zh-TW/QuestionAnswer/_ListByType)；未查到可確認的線上售票入口 |
| 故宮南院 | 南院參觀券 NT$150 | [南院票價](https://south.npm.gov.tw/Visit/Ticket.htm)；館方連至 [Fonticket](https://npm.fonticket.com/) |
| 故宮北院 | 國人持證 NT$150／一般 NT$350 | [北院票價](https://www.npm.gov.tw/Articles.aspx?l=1&sno=02007004)；館方連至 [Fonticket](https://npm.fonticket.com/) |
| 國立科學工藝博物館 | 常設展示廳全票 NT$120 | [館方票價](https://www.nstm.gov.tw/Reference/VisitorInformation/Price.htm)；[官方線上購票](https://mobile.nstm.gov.tw/Ticket)；特展另依規定 |
| 國立臺灣科學教育館 | 常設展 3–6 樓全票 NT$120 | [館方票價總覽](https://www.ntsec.gov.tw/article/detail.aspx?a=23)；館方連至 [Fonticket](https://ntsec.fonticket.com/)；線上常設展票限當日 |
| 國立海洋生物博物館 | 一般入館全票 NT$450 | [館方票價](https://www.nmmba.gov.tw/cp.aspx?n=A6476B49BA86BBD5&s=B3CCAAE6060F5DB7)；館方連至[經營團隊票券頁](https://www.aquarium.com.tw/products_a.asp) |

已查證的個別展覽：奇美博物館[《埃及之王：法老》官方購票資訊](https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a690b20b793)列全票 NT$580、優惠票 NT$480，購票需選參觀日期。此票價只對應該檔展覽的官方展覽 URL，不套用至奇美其他展覽。

維護方式：先核對館方票價頁與售票入口仍有效，再修改 `src/ticketing.ts` 的金額、網址、說明及 `checkedOn`；如展覽專屬票價無法再確認，撤下對應 override。不要從一般館票推斷特展收費或免費；資料來源只有模糊文字時，讓卡片顯示「尚未核對」。單元與整合測試通過後，再檢查本機網站卡片與九館索引。
