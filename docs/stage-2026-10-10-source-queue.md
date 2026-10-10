# 階段紀錄：本機 PostgreSQL 來源工作佇列

日期：2026-10-10。此階段只做本機手動 `FETCH_SOURCE` Queue，沒有推送、公開部署或啟用線上每日同步。

## 問題與實作

原本五館只能直接執行 `sync --source`；某個進程結束後沒有可持續查詢的待執行／進行中／死信工作狀態。這次新增 `source_jobs`：同館同一臺灣日期使用固定冪等鍵，重複入列回傳既有工作。`pending` 工作到期後由 PostgreSQL `FOR UPDATE SKIP LOCKED` 交給一個 worker，取得三分鐘租約與 token；worker 執行單館 `ingest --official`，最多 90 秒。每次結果寫入 `sync_attempts`，供既有來源健康報告讀取。

暫時錯誤按 30 秒、2 分鐘退避，最多三次；資料格式等非暫時錯誤直接進 `dead`，不讓同一筆一直重試。死信人工確認後以新工作重播，保留原工作及嘗試歷史。worker 崩潰後，下一次領取會記錄過期租約失敗並退避；過期 token 不能寫回工作結果。若舊 worker 已完成來源資料庫匯入但在回報前租約過期，匯入本身靠來源鍵、唯一約束與交易保證重跑冪等；不能保證外部 HTTP 只呼叫一次。

## 操作

先執行 `npm run migrate`。在本機、已設定 `.env` 的環境下：

```powershell
npm run jobs:enqueue -- --source all
npm run jobs:work
npm run jobs:status
# 若要持續輪詢，可用 npm run jobs:work -- --loop
# dead 工作檢查原因後，再用 npm run jobs:replay -- --id <UUID>
```

`jobs:work` 預設只取一筆；`--loop` 每五秒輪詢。`jobs:enqueue` 也接受單館與 `--date YYYY-MM-DD`。目前每日 workflow 仍走原本直接同步且受關閉閘門保護；此功能不會在背景自動啟動。隊列只分派來源工作；Parser、Normalization、Upsert 與 Change Detection 仍在一次匯入內，通知尚未實作。

## 驗證與限制

`npm run typecheck`、`npm test`（33/33）及隔離 PostgreSQL 的 `npm run test:integration` 通過。整合測試覆蓋重複入列、兩個 worker 並行領不同工作、成功與暫時失敗互不阻塞、退避、非暫時錯誤死信、人工重播、租約過期回收及舊 token 拒寫；單元測試檢查臺灣日期日界線與錯誤日期。測試用模擬工作結果，**沒有**聲稱 Queue worker 已連續運行或對五館做真實來源壓測。技術取捨見[ER-33](technical-decisions.md#er-33postgresql-來源工作佇列已實作本機整合測試)。
