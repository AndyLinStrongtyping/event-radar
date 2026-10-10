# 階段紀錄：官方來源清單完整度保護

狀態：2026-10-10，本機已實作並以隔離 PostgreSQL 驗證；尚未公開部署或啟用線上每日同步。

## 問題與決策

既有缺席比對只要求官方匯入有至少一筆有效展覽。來源只回一頁、解析器漏抓部分項目時，仍可能將多筆既有展覽列為缺席，或因待審判定隱藏舊展。現在於匯入同一交易比較「不同來源鍵數」與「可公開展覽數」的前一次可信基準。第一次官方清單只建基準；任一筆數從至少 4 筆跌至一半或更少、且至少少 2 筆時，暫緩缺席新增／結案及待審資料導致的舊展隱藏，原基準不變。其餘有效展覽照常匯入。

## 實作與操作

- [`db/012_source_coverage.sql`](../db/012_source_coverage.sql)新增每館／provider 比較基準與 `ingestion_runs` 的 provider、觀測筆數、基準筆數、判定狀態。既有歷史匯入沒有可信的來源清單基準，因此不從舊資料猜測回填。
- [`src/source-coverage.ts`](../src/source-coverage.ts)在匯入交易中讀取並鎖定基準；[`src/ingest.ts`](../src/ingest.ts)僅在 `checked` 時呼叫缺席比對。疑似縮水的執行仍回傳成功，但 stderr 提醒人工核對。
- `sync:status` 回傳最近官方完整度判定；登入本機 `/health` 也提示疑似縮水，健康狀態列「有資料需要核對」。
- 先執行 `npm run migrate`。排查時可查：

```sql
SELECT museum_id, provider, started_at, coverage_status,
       source_identity_count, coverage_baseline_count,
       source_row_count, coverage_baseline_row_count
FROM ingestion_runs
WHERE coverage_status <> 'not_applicable'
ORDER BY started_at DESC LIMIT 20;
```

遇到 `deferred_partial`，核對館方原頁、分頁及解析器；不要把它當成已取消展覽的證據。首次 `baseline_created` 也不會核對舊展缺席。若來源真的永久大幅縮小，後續仍會暫緩，須先人工確認再設計可追溯的基準重設流程；目前沒有自動重設命令。

## 審查後修正（2026-10-10）

原流程在檢查完整度之前，就可能因來源紀錄轉待審而隱藏舊展。現在先評估完整度，再決定是否執行可見性變更。`deferred_partial` 時保留待審原始資料與新取得的有效展覽，但不因這批不完整清單隱藏既有展覽；官方來源 0 筆可公開資料則記失敗且不隱藏舊展。手動快照的單筆失效隔離規則不變。

公開 `/museums` 加入 `coverageStatus`。它與 `dataStatus` 是兩個維度：前者說明清單是否疑似不完整，後者說明來源取得時間及失敗狀態。網站會同時顯示兩者，不因本次匯入刷新官方成功時間就掩蓋警示。隔離 PostgreSQL 整合測試已走完科工館 6 筆完整清單、HTML 只可核對 2 筆、恢復 6 筆三次匯入，並檢查可見性、待審紀錄與公開 API。

## 驗證與界線

`npm run typecheck`、`npm test`（34/34）及隔離 PostgreSQL `npm run test:integration` 通過。測試涵蓋大幅縮水、基準保留、完整恢復，以及原始鍵數不變但解析後可公開筆數驟降。尚未以真實館方縮水故障驗證；這是筆數警示，不是完整性證明。小清單、漸進縮小或同筆數換內容仍可能漏判，人工查證仍必要。
