# Phase 2 階段紀錄｜國立臺灣美術館

核對日期：2026-10-11（臺灣時間）。本階段依使用者要求先做第一間美術館；Phase 1 的奇美完整覆蓋及五館跨週可靠性仍保留追蹤，部署依原路線延後。

## 真實來源與範圍

- [國美館當期展覽](https://www.ntmofa.gov.tw/News_Actives_photo.aspx?n=1462&sms=11893)及[展覽預告](https://www.ntmofa.gov.tw/News_Actives_photo.aspx?n=1464&sms=11893)是 HTML 清單，不是公開 API。清單逐筆連往文化部 NTMOFA 詳情；例如[藝術教育展](https://event.culture.tw/mocweb/reg/NTMOFA/Detail.init.ctr?actId=60146)明載展期、B1 教育展示空間、3 位參展藝術家及相關系列活動。
- 只讀探針共見 12 張卡；3 筆有可核對的臺中本館限期展，9 筆是館外、線上、常設或公告而略過。預告頁當次唯一項目位於臺北國家攝影文化中心，因此沒有加入臺中本館搜尋。首批沒有可安全映射為「策展人」的明確人名，`curatorNames=[]`。
- `npm run probe:ntmofa` 只讀、只列必要摘要；`npm run sync -- --source ntmofa` 在本機資料庫執行一次，結果 fetched 12、inserted 3、skipped 9、review 0、`baseline_created`。這是首次比較基準，不能證明完整或跨週穩定。

## 實作與驗證

- Adapter：`src/sources/ntmofa.ts`。來源 ID 做 `ntmofa:<actId>`；官方清單與詳情標題須一致，日期必須完整有效，館外與常設不進共通搜尋。失聯或資訊不足逐筆待審，空清單與重複 ID 停止匯入。
- 資料模型：`db/016_art_exhibitions.sql`。`museums.venue_type` 區分美術館；`art_exhibition_details`、`art_related_events` 與 `art_exhibition_changes` 保留 Domain 欄位及更動。共通展覽仍負責展期、搜尋、去重及來源健康。
- 查詢：`GET /museums` 加 `venueType`，`GET /exhibitions`／逐筆詳情加 nullable `art`。React 展開卡片顯示有證據的人物、展區和官方相關活動；場次是否仍有效須回館方核對。
- 館所圖鑑：新增 [`ntmofa.html`](../web/guides/ntmofa.html)及首頁第十張卡，整理典藏策劃展的認識路線、樓層、平常開放時間與交通入口。據[館方時間／票價](https://www.ntmofa.gov.tw/cp.aspx?n=1420)人工核對一般入館免費及週二至週日時間；`/visit-status` 僅回 `unknown` 與館方連結，不推定某日開館。外觀照是 Chi-Hung Lin 2009 年 CC BY-SA 3.0 作品，已在[署名頁](../web/photo-credits.html)標示過期展覽布條與裁切。
- 型別、React build、56 項單元與隔離 PostgreSQL 整合測試通過。整合測試建立空白資料庫套用 16 份 migration，重跑同一國美館來源不重複，藝術家變更留下 1 筆異動，相關活動外鍵及 OpenAPI 實際 HTTP 回應均通過。本機新版 3006 埠 API 確認 3 筆展覽，教育展 `artistNames` 為宋周妍、胡宮雪娜、胡啟仁，`floor=B1`；圖鑑與照片路由均回 200，`visit-status` 回 `unknown` 與官網連結。

## 下一步門檻

1. 跨週觀察官方清單與來源鍵是否穩定，核對頁面是否有隱藏分頁或其他館內限期展；不能把單日 3 筆當成完整覆蓋。
2. 若要更多策展人資料，逐筆查有明確「策展人」標籤的官方頁；「展覽策劃」不自動等同策展人。相關活動若要顯示可報名狀態，需另外取得場次日期與狀態，不能從關聯連結推測。
3. 每週 Queue、線上排程與部署按 roadmap 的後續階段處理；目前國美館只有本機手動同步，未公開發布。
