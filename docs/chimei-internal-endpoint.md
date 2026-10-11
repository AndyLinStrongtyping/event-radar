# 奇美官網內部 JSON 端點：候選來源與驗證界線

紀錄日期：2026-10-11。**候選來源，尚未接入匯入器或每週排程。**這是奇美官網頁面自己使用、未公開文件化的 JSON 端點，不稱作「奇美官方公開 API」，也不代表館方授權第三方持續介接。

## 已知與尚未證明

- 使用者由 Chrome DevTools Network 觀察到 `POST https://www.chimeimuseum.org/exhibition-event/api`，payload 為 `{"date":"","tags":""}`；回應含 `specialEvent`、`permanentEvent`、`expoEvent`。三組頂層名稱已由本站單次正常公開頁流程驗證；各筆欄位與日期例子仍以使用者的 DevTools 觀察為依據，尚未逐欄建立契約測試。
- 本機於 2026-10-11 低頻檢查：`robots.txt` 回 200，列出 `Disallow: /weyacms/`、`Disallow: /admin/`；隨後一次不帶 Cookie／session／CSRF token 的 Node POST 回 **419**、`application/json`，只見頂層 `message`，沒有三組活動資料。未嘗試繞過保護。robots 未禁止該路徑不等於資料重用授權。館方[展覽與活動頁](https://www.chimeimuseum.org/exhibition-event)的初始 HTML 使用前端模板，不能從該 HTML 推定完整活動數；[著作權與隱私權頁](https://www.chimeimuseum.org/privacy)也未提供此端點的公開介接授權。
- 同日再由公開展覽頁正常取得匿名 `XSRF-TOKEN`、`chimeimuseum_session` cookie 與 CSRF meta，使用該次暫時 session 送出同一 POST，回 **200 JSON**；頂層三組分別有 `specialEvent=1`、`permanentEvent=4`、`expoEvent=10`。只記狀態與筆數，未保存 cookie、token 或回應全文，也未碰登入／驗證碼。這證明當次**正常公開頁流程技術上可讀**，不是公開文件化 API 或長期可用性的證據。
- 尚未完整核對官網實際顯示數與各組回應數、伺服器隱含資料上限、連續多日 schema 穩定度，以及 cookie 與 CSRF 各自是否必要。無 session 的 419 與正常公開頁流程的 200 都要保留；目前仍不能標為穩定來源。

**後續實測補充**：2026-10-11 已用 Node.js 以同樣匿名流程取得 200，並核對 `date=2026-10-11`、`tags=68` 篩選；官網前端程式未見分頁參數，當日唯一限期特展日期與官方詳情頁一致。這縮小了技術風險，但仍不能證明跨日穩定、清單完整或再利用條件。詳細筆數、欄位與啟用門檻見[階段核對](stage-2026-10-11-chimei-probe.md)。

## 適配器設計（待驗證後實作）

奇美特有欄位只能在 `ChimeiSourceAdapter` 內解析。下游仍接收本站共用的來源候選、待審紀錄與 `ExhibitionDraft`；不依賴 `specialEvent` 等名稱。產品目前只搜尋有可信起訖日的限期特展，三組資料先分流：

| 來源組別 | 使用者觀察欄位 | 本站預定處理 |
| --- | --- | --- |
| `specialEvent` | `id`、`img`、`link`、`tag`、`title`、`txt`、`date`、`isfree` | 限期特展候選；展名、詳情連結與完整日期驗證通過才公開。 |
| `permanentEvent` | `link`、`webp`、`image`、`mimetype`、`subtitle`、`title`、`intro` | 常設展導覽候選，與限期特展搜尋分開；不因缺結束日就塞進展覽主表。 |
| `expoEvent` | `id`、`img`、`link`、`hastag`、`tag`、`type`、`location`、`title`、`isfree`、`hasdate`、`date` | 活動／節目候選；本站現階段不自動混入限期特展搜尋。若日後納入，先定義類型與多場次模型。 |

`date` 需保存來源原文 `rawDate`，先安全清理 HTML（`<br>` 保留為分隔，不直接拼接兩段日期），再解析已明確確認的格式，例如 `YYYY.MM.DD - YYYY.MM.DD` 與 `YYYY/MM/DD - YYYY/MM/DD`。解析結果可在適配器內標 `date_range`、`multiple_dates`、`ongoing`、`time_only`、`unknown`；「即日起」、只有時段、已開課或多個不連續場次**不可猜成單一起訖日**。來源／待審層的 `startDate`、`endDate` 可為 `null`，但現有公開 `exhibitions.start_date/end_date`、`ExhibitionDraft` 與搜尋 API 都要求有效起訖日；不為了遷就來源格式而直接放寬公開表。需要展示多場次時再設計 occurrence 資料模型。

來源身份建議使用 `museum_id=chimei`、獨立 `provider` 與帶類型的 `source_key`（如 `special:207`）；無 ID 的常設展候選採正規化後的穩定詳情 URL。現有 `exhibition_sources` 與 `source_records` 已有 `(museum_id,provider,source_key)` 唯一鍵，可承接此身份；但 [`normalizeExhibition`](../src/normalize.ts)目前會把奇美等大多數來源的 `sourceKey` 改為 `sourceUrl`。**實作前必須修改這個來源鍵規則並補測試**，否則 ID 去重設計不會生效。常設展若留在靜態導覽，不必先寫入 `exhibition_sources`。

現有 `exhibition_changes` 只支援 `title`、`venue`、`startDate`、`endDate`、`priceNote`、`sourceUrl`、`summary`。新增 `rawDate`、`isFree`、`type`、`tag` 的欄位歷史，需要先定義對外語意、資料表遷移及變更測試；不能在文件中當成已完成。來源消失也不能直接推定活動取消或刪除。現有疑似清單縮水保護 `deferred_partial` 可作設計基礎，但新來源須按組別、篩選與分頁比較筆數，並區分 `lastFetchAt`、成功解析時間、最後可信完整同步時間；419、空回應或疑似部分回應不能刷新「完整來源已同步」聲明。

## 取用與啟用條件

維持低頻、可辨識請求、逾時與有限次重試；候選來源先以**每週一次**只讀檢查評估，必要時人工觸發；沒有資料變動需求證據前不提高頻率。只處理一般訪客可正常看到的必要欄位，保留館方詳情連結與資料來源標示，不鏡像全文或批次下載官網圖片；圖片 URL 也不等於已取得再利用許可。個人非商業作品集定位本身不產生資料或圖片授權；若要公開或商業化，重新評估條款並視需要向館方確認。

正式建立 adapter 前，先核對：同條件下官網與回應的各組筆數；`date`、`tags` 行為；分頁；無 session 的呼叫；是否需要 Cookie／CSRF；跨週 schema；分類後可公開的特展筆數和缺日期比例。若取得資料需要模擬或繞過站點保護，停止這條自動介接方案，改採館方可接受的資料取得方式。驗證完成前，奇美仍維持人工核對資料與文化部補充來源，週檢查仍只讀、不宣稱完整同步。
