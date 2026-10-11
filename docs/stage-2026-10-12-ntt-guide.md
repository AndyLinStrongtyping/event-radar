# 2026-10-12｜臺中國家歌劇院場館圖鑑

## 交付

- React 圖鑑新增第十一張卡，連到 `/guides/ntt.html`；這是表演場館，沒有混入臺灣博物館特展搜尋。
- 導覽頁依歌劇院[場域空間](https://www.npac-ntt.org/about/architecture/venue)、[開館與交通](https://www.npac-ntt.org/visit/transportation)、[導覽服務](https://www.npac-ntt.org/visit/tour/introduction)整理建築、三座劇場、平常開館時間與行前提醒，連回首頁的表演節目區。
- 交通起點表單加入歌劇院目的地；外觀照片採 [Ralffralff 的 Wikimedia Commons 作品](https://commons.wikimedia.org/wiki/File:National_Taichung_Theater,_Nov_2024_(2).jpg)，依 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)標示作者、來源、授權、縮圖與裁切，並提醒 2024 年照片中的節目廣告不代表當期演出。

## 驗證與界線

- `npm run typecheck`、`npm test`（59 項）、`npm run build:web`、`npm run test:integration` 通過；整合測試新增頁面與照片 HTTP 200 檢查。
- 本機 `http://127.0.0.1:3008/guides/ntt.html` 已開啟核對：標題、開館資訊、圖片、交通表單及表演節目入口可見。
- 開館時間為人工核對的例行時間，不推定特定日期；觀眾席是否開放、節目票務及臨時休館以歌劇院官方公告為準。既有 Phase 3 節目匯入範圍未擴大。
- Phase 5 沖繩來源與圖鑑依使用者指示暫停。本階段沒有新增日本資料來源、資料庫表、API 或排程。
