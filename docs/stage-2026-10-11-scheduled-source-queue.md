# 階段紀錄：每日同步接入來源 Queue

日期：2026-10-11。此階段完成排程的程式執行路徑與隔離 PostgreSQL 驗證；**沒有啟用 GitHub Actions 每日同步，也沒有公開部署**。

## 問題與處理

先前 `.github/workflows/daily-sync.yml` 各館直接呼叫 `sync --source`，與已做好的 `source_jobs` 表、租約及死信流程是兩條路。現在 workflow 的五館工作改呼叫 `jobs:daily -- --source <館別>`：以臺灣日期建立同館當日工作，依 job ID 領取，執行既有 `ingest --official`，等待 30 秒／2 分鐘退避後的下一次嘗試，直到成功、進入 `dead` 或八分鐘等待上限。最終 `dead` 或逾時使命令回傳非零碼。五個來源仍由獨立的 workflow job 執行；其中一館失敗不會阻止其他館執行。

`claimSourceJob` 新增選用的目標 job ID。排程呼叫時連過期租約回收也只看自己的工作，避免因別館待辦先到期而領錯工作。原本不帶 ID 的 `jobs:work` 仍可從整個 Queue 領工作。同館同日重跑會回傳原工作；成功者不重抓，死信者不自動重播，保留人工核對後建立新工作或直接同步的選擇。

## 操作與界線

先在資料庫執行 `npm run migrate`，本機可用 `npm run jobs:daily -- --source nstm` 驗證單館。`npm run jobs:status` 查最後狀態；永久失敗先核對來源與解析器，再以 `jobs:replay -- --id <UUID>` 建新工作，或手動用 `sync -- --source <館別>` 重新抓取。八分鐘等待上限包含退避等待，但一次匯入最多仍有 90 秒執行時間；外層 GitHub Actions 工作上限是十分鐘。單日重跑不能當「強制重新抓取」使用。

這個 Queue 仍只有 `FETCH_SOURCE`；Parser、Normalization、Upsert 與 Change Detection 留在同一匯入流程。沒有通知 Queue、遠端監控、AWS 或已運作的線上排程。GitHub workflow 仍受 `EVENT_RADAR_SYNC_ENABLED` 閘門保護；啟用前還需可連線的遠端 PostgreSQL、migration、Secrets 和手動來源驗證。

若執行函式本身意外拋出例外，排程會把該工作記為不可重試失敗並送入 `dead`，避免留下只能等租約過期的 `running` 狀態；資料庫完成紀錄失敗仍會原樣拋出，由後續領取流程回收租約。

## 驗證

`npm run typecheck`、`npm test`（37/37）與隔離 PostgreSQL `npm run test:integration` 通過。整合測試額外覆蓋單館工作經過一次暫時失敗後成功、同日成功工作不重抓、永久失敗進 `dead`，以及別館到期工作不被這個排程領走。沒有用真實館方流量執行每日 workflow；那仍是待驗證事項。技術取捨見 [ER-39](technical-decisions.md#er-39每日排程接入單館來源-queue已實作本機驗證)。
