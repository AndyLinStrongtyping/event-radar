# 奇美官網內部 JSON 端點：候選來源與驗證界線

紀錄日期：2026-10-11。**候選來源：限期特展已有離線適配器；活動／節目另有人工快照及本機候選活動表。限期特展未接入自動匯入，奇美活動未接入每週排程或公開活動 API。**這是奇美官網頁面自己使用、未公開文件化的 JSON 端點，不稱作「奇美官方公開 API」，也不代表館方授權第三方持續介接。

## 已知與尚未證明

- 使用者由 Chrome DevTools Network 觀察到 `POST https://www.chimeimuseum.org/exhibition-event/api`，payload 為 `{"date":"","tags":""}`；回應含 `specialEvent`、`permanentEvent`、`expoEvent`。三組頂層名稱已由本站單次正常公開頁流程驗證；各筆欄位與日期例子仍以使用者的 DevTools 觀察為依據，尚未逐欄建立契約測試。
- 本機於 2026-10-11 低頻檢查：`robots.txt` 回 200，列出 `Disallow: /weyacms/`、`Disallow: /admin/`；隨後一次不帶 Cookie／session／CSRF token 的 Node POST 回 **419**、`application/json`，只見頂層 `message`，沒有三組活動資料。未嘗試繞過保護。robots 未禁止該路徑不等於資料重用授權。館方[展覽與活動頁](https://www.chimeimuseum.org/exhibition-event)的初始 HTML 使用前端模板，不能從該 HTML 推定完整活動數；[著作權與隱私權頁](https://www.chimeimuseum.org/privacy)也未提供此端點的公開介接授權。
- 同日再由公開展覽頁正常取得匿名 `XSRF-TOKEN`、`chimeimuseum_session` cookie 與 CSRF meta，使用該次暫時 session 送出同一 POST，回 **200 JSON**；頂層三組分別有 `specialEvent=1`、`permanentEvent=4`、`expoEvent=10`。只記狀態與筆數，未保存 cookie、token 或回應全文，也未碰登入／驗證碼。這證明當次**正常公開頁流程技術上可讀**，不是公開文件化 API 或長期可用性的證據。
- 尚未完整核對官網實際顯示數與各組回應數、伺服器隱含資料上限、連續多日 schema 穩定度，以及 cookie 與 CSRF 各自是否必要。無 session 的 419 與正常公開頁流程的 200 都要保留；目前仍不能標為穩定來源。

**後續實測補充**：2026-10-11 已用 Node.js 以同樣匿名流程取得 200，並核對 `date=2026-10-11`、`tags=68` 篩選；官網前端程式未見分頁參數，當日唯一限期特展日期與官方詳情頁一致。這縮小了技術風險，但仍不能證明跨日穩定、清單完整或再利用條件。詳細筆數、欄位與啟用門檻見[階段核對](stage-2026-10-11-chimei-probe.md)。

**離線適配器核對**：同日第二次只讀 probe 回 200，三組仍為 1／4／10；適配器將唯一限期特展列為 1 筆結構可解析候選、0 筆待審。它尚未核對此候選與既有人工資料的資料庫身份，也未通過跨週觀測，因此不把這次結果當成可自動發布的證據。

## 候選適配器（已實作離線分類，未開啟自動匯入）

[`chimei-internal.ts`](../src/sources/chimei-internal.ts)只在此處解析奇美特有的頂層組別；下游取得共用的 `SourceRecord` 與 `ExhibitionDraft`，不依賴 `specialEvent` 等名稱。這個函式不發網路請求或寫入資料庫；只對 `specialEvent` 產生候選紀錄，另外兩組只計筆數，不混入特展搜尋。現有只讀 probe 已呼叫此函式，回報結構上可轉換與需待審的特展筆數。尚未核對詳情頁的候選紀錄，**不能僅憑適配器的 ready 狀態直接公開**。

| 來源組別 | 使用者觀察欄位 | 本站預定處理 |
| --- | --- | --- |
| `specialEvent` | `id`、`img`、`link`、`tag`、`title`、`txt`、`date`、`isfree` | 限期特展候選；展名、詳情連結與完整日期驗證通過才公開。 |
| `permanentEvent` | `link`、`webp`、`image`、`mimetype`、`subtitle`、`title`、`intro` | 常設展導覽候選，與限期特展搜尋分開；不因缺結束日就塞進展覽主表。 |
| `expoEvent` | `id`、`img`、`link`、`hastag`、`tag`、`type`、`location`、`title`、`isfree`、`hasdate`、`date` | 活動／節目候選；本站以一次性快照在獨立區塊展示必要文字和官方連結，**不混入限期特展搜尋**。若日後要做日期搜尋，先定義多場次模型。 |

`npm run refresh:chimei:activities` 會以公開頁正常匿名流程取得三組資料、檢查活動 ID 與官方詳情網址，再原子更新 `data/chimei-activities.json`。它是**人工觸發的快照更新**，不是排程同步；空清單、縮水達一半或 ID 大量更換時保留舊快照。前端只顯示標題、類型、清理 HTML 後的館方時間文字和官網逐筆連結，不保存圖片、長篇介紹、匿名 cookie 或 CSRF token。來源時間可能含售票日、多場次、即日起或僅時段，沒有安全解析的情況不推論「即將開始」或「展出中」，訪客須回官網確認。詳細見 [ER-50](technical-decisions.md#er-50奇美活動與節目的人工更新快照已實作本機驗證)。

在執行 `npm run migrate` 後，可**人工**執行 `npm run import:chimei:programmes`，把上述快照放入本機 `programme_events` 候選表。來源身份固定為 `chimei + chimei-internal + expo + <id>`，`UNIQUE` 約束與交易鎖阻止重複；相同內容只更新最後核對時間，欄位變更寫入 `programme_event_changes`。解析器只把明確完整範圍加「博物館開放日」轉為日期；音樂節列為多場次、即日起列為長期、僅時段列為 time-only，工作坊含售票日列為 unknown，皆保留 `raw_date` 且起迄日為 `NULL`。來源消失不刪除或自動標取消；舊快照與大幅縮水回滾。這些表**尚未成為公開 API 或前端卡片的資料源**；前端仍讀人工快照。見 [ER-51](technical-decisions.md#er-51奇美活動候選表的冪等匯入與異動歷史已實作本機驗證)。

`date` 在候選的最小化原始紀錄中保留 `rawDate`，先將 `<br>` 留成分隔，再解析明確格式，例如 `YYYY.MM.DD - YYYY.MM.DD` 與 `YYYY/MM/DD - YYYY/MM/DD`。適配器可標 `date_range`、`multiple_dates`、`ongoing`、`time_only`、`unknown`；「即日起」、只有時段、已開課或多個不連續場次**不可猜成單一起訖日**。無法安全解析的候選之 `startDate`、`endDate` 為 `null` 並標 `review`；現有公開 `exhibitions.start_date/end_date`、`ExhibitionDraft` 與搜尋 API 仍要求有效起訖日。需要展示多場次時再設計 occurrence 資料模型。

來源身份使用 `museum_id=chimei`、未來獨立 `provider` 與帶類型的 `source_key`（如 `special:207` 或字母數字 ID）。[`normalizeExhibition`](../src/normalize.ts)現已只對符合 `special:<id>` 的奇美來源鍵保留 ID；其他奇美匯入仍沿用原有官方網址鍵。API 的單段特展連結與官網詳情的雙段連結都只在奇美 HTTPS 網域接受；正式匯入前仍須核對跳轉後的詳情、舊人工資料關聯與網址異動時的身份。常設展暫不寫入 `exhibition_sources`。

現有 `exhibition_changes` 只支援 `title`、`venue`、`startDate`、`endDate`、`priceNote`、`sourceUrl`、`summary`。新候選活動表另記 `title`、`rawDate`、`scheduleType`、`startDate`、`endDate`、`eventType`、`sourceUrl` 的異動；`isFree`、`location`、`tag` 尚未有安全定義與入庫，不宣稱已追蹤。來源消失也不能直接推定活動取消或刪除。現有疑似清單縮水保護 `deferred_partial` 可作設計基礎，但新來源須按組別、篩選與分頁比較筆數，並區分 `lastFetchAt`、成功解析時間、最後可信完整同步時間；419、空回應或疑似部分回應不能刷新「完整來源已同步」聲明。

## 取用與啟用條件

維持低頻、可辨識請求、逾時與有限次重試；候選來源先以**每週一次**只讀檢查評估，必要時人工觸發；沒有資料變動需求證據前不提高頻率。只處理一般訪客可正常看到的必要欄位，保留館方詳情連結與資料來源標示，不鏡像全文或批次下載官網圖片；圖片 URL 也不等於已取得再利用許可。個人非商業作品集定位本身不產生資料或圖片授權；若要公開或商業化，重新評估條款並視需要向館方確認。

正式**接入匯入器**前，先核對：同條件下官網與回應的各組筆數；`date`、`tags` 行為；分頁；無 session 的呼叫；是否需要 Cookie／CSRF；跨週 schema；候選特展的官方詳情與缺日期比例。若取得資料需要模擬或繞過站點保護，停止這條自動介接方案，改採館方可接受的資料取得方式。驗證完成前，奇美仍維持人工核對資料與文化部補充來源，週檢查仍只讀、不宣稱完整同步。
