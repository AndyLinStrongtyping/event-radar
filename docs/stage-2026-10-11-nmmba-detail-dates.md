# 2026-10-11｜海生館缺漏展期的官方逐筆頁核對

海生館的[公開特展 JSON](https://www.nmmba.gov.tw/OpenData.aspx?SN=BF6D6EB9CB6876BB)本來就可自動取得，問題是部分紀錄的 `app用開始時間`、`app用結束時間` 留白。上一輪 30 筆中 26 筆因此待審。抽看這些紀錄發現，多數是舊展、只有開展日，或介紹文字根本沒有明確展期；不能補成目前仍展出。

新增 [`src/sources/nmmba-detail.ts`](../src/sources/nmmba-detail.ts)，只針對介紹文字標示「展出日期」且有唯一完整起訖日的候選，讀取同筆官方 `Source` 詳情頁。頁面標題、完整展期需與 JSON 一致；任何既有日期欄不得衝突。其他紀錄以及詳情頁暫時無法取得時維持待審。這讓少量可核對紀錄進入既有正規化與資料庫流程，沒有把 26 筆逐頁抓取，也沒有依「永久典藏」等文字推測結束日期。

真實本機同步結果：來源仍是 30 筆，可公開資料由 4 增至 5，待審由 26 降至 25，完整度檢查為 `checked`。唯一新增的《SEA YOU〈海洋的見證與再造〉》可由[館方詳情頁](https://www.nmmba.gov.tw/News_Content.aspx?n=3BA711487C292039&s=5782585BC788F20F)核對 2026-04-02 至 2026-06-28；本機 `/exhibitions?museum=nmmba&status=ended` 回傳它的 `exhibitionStatus=ended`，不會冒充目前展出。`/museums` 顯示海生館 `pendingReviewCount=25`。兩者均為本機 API 實測。

驗證：`npm run typecheck` 通過、`npm test` 48/48 通過、`npm run test:integration` 在隔離 PostgreSQL 通過。單元測試涵蓋日期標籤、真實日曆、頁面標題不一致、日期矛盾、非官方網址、請求失敗及沒有候選不請求。線上每週同步仍未啟用；未逐筆人工確認剩下的 25 筆，也不宣稱它們是當期展覽。
