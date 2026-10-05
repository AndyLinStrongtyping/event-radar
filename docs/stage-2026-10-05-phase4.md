# 第四階段：科博館 OpenAPI 與出發前休館提醒

日期：2026-10-05，臺灣時間。本階段僅在本機實作及核對，**網站仍未公開部署，線上每日同步仍未啟用**。

## 已完成

- 科博館個人金鑰已核發。`NMNS_API_KEY` 放在 Git 忽略的本機 `.env`；沒有進入程式、文件、Git 或瀏覽器。`npm run ingest -- --source nmns --official` 優先呼叫[館方當期展覽 API](https://www.nmns.edu.tw/ch/about/info-central/opendata/index.html)，無金鑰時保留原公開 JSON 來源作備援。
- 同一份官方 API 的 `Calendar/weekHours` 可查未來一週逐日 `holiday`、開閉館時間。`GET /visit-status` 只對本館及查詢日期回報開館／休館，無資料、超出一週或連線失敗時顯示「未知」及[館方開放時間頁](https://www.nmns.edu.tw/ch/visit/hours/)；伺服器快取成功結果一小時。
- 奇美依[館方全年行事曆](https://www.chimeimuseum.org/visit/calendar)公布的週三休館規則提醒；其他日期不推論為必定開館，提供[館方訊息](https://www.chimeimuseum.org/news/5fd2eee2256ee)入口確認臨時公告。其他館目前只提供官網連結，不假裝已具備逐日資料。
- 搜尋頁選定館所及日期後顯示提醒，避免看見特展展期便誤以為當天開館。

## 實測

- 科博館 API 文件的介接說明寫 `apiKey` Header，但實測展覽端點回覆「未傳入金鑰」。[官方 Swagger 規格](https://www.nmns.edu.tw/swagger/)寫 `key` query 參數；依此實測成功回傳 7 筆。程式僅對館方 HTTPS 傳送，且不記錄含金鑰的 URL 或底層連線例外。
- 本機官方展覽同步：`fetched=7, inserted=0, updated=0, unchanged=7`，證明重跑沒有新增重複展覽。
- 科博館逐日 API：2026-10-05 回報休館，2026-10-06 回報開館 09:00–17:00。首頁實際在本機瀏覽器顯示休館提醒及官方連結；奇美週三也回傳休館提醒。
- 單元測試涵蓋無效日期、奇美週三、科博館逐日 `holiday` 與資料缺失退回未知。

## 仍待處理

- [奇美最新消息](https://www.chimeimuseum.org/news)在瀏覽器可看到館方訊息（包含臨時休館公告），但原始 HTML 只有前端模板，沒有完整新聞清單。館方未提供可供第三方穩定介接的公開新聞 API；目前保留館方入口，不宣稱已自動爬取休館公告。
- 其他館逐日休館資料需要各自核對官方資料來源；不能從展覽存在推論開館。
- 線上同步、公開網站、Queue、通知及 AWS 尚未實作或啟用。
