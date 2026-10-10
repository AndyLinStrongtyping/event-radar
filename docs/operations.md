# 每日同步運作設計

目標頻率為臺灣時間每日 04:15。排程在非整點，降低 GitHub Actions 整點壅塞機率；它仍可能延遲或漏跑，不能承諾準點更新。來源資料本身若未更新，重跑只刷新最後看見時間。

`.github/workflows/daily-sync.yml` 已備妥，但**尚未啟用**。預設所有同步工作與奇美每週檢查都由 `EVENT_RADAR_SYNC_ENABLED` 閘門關閉；推送程式碼只執行 CI 驗證，不會連接外部資料庫。啟用條件：

1. 專案放到獨立 GitHub repo 的預設分支。
2. 建立可從 GitHub Actions 連線的 PostgreSQL；**空白庫**執行 `npm run migrate` 即可。若沿用早期手動建表的舊庫，先備份、核對結構，再執行一次 `npm run migrate -- --baseline-existing`。這只登記已存在的 001–012；結構缺漏會拒絕，不能用基線命令跳過真正缺少的 migration。
3. Repository secrets 設 `DATABASE_URL` 與 `NMNS_API_KEY`。後者只在決定啟用線上同步時設定，切勿寫入程式碼、文件或 workflow 日誌；`NMNS_OPEN_DATA_URL` 可作展覽匯入的無金鑰備援，不能提供逐日開放時間。
4. Repository variable 設 `EVENT_RADAR_SYNC_ENABLED=true`，先手動執行一次並確認 `ingestion_runs` 與 `/health`，才依排程運作。

每日同步 workflow 定義五個相互獨立的工作，每個工作使用 jobs:daily 建立同館當日 Queue 工作，只領取自己的 job ID，等待重試後的最終結果；這條執行路徑已寫入 workflow，但尚未在線上啟用或驗證。五個來源為：科博館官方 OpenAPI（有 Key 時優先；公開 JSON 備援）、故宮南院官方當期／預告頁、故宮北院公開 JSON、海生館公開 JSON、科工館公開 JSON 加官方特展列表核對。文化部奇美資料目前只在本機手動匯入，因官方 OpenAPI 未確認分頁及完整涵蓋率。匯入先驗證來源，再在交易中寫入；來源為空、頁面格式改變或寫入錯誤時記失敗，`last_success_at` 不前進。逐筆可隔離的品質問題會存原始紀錄；若整批 **0 筆可公開展覽**，保留原始／待審資料、記失敗並回傳非零碼，不把這次嘗試當成成功同步。有有效展覽但部分待審時仍可成功。故宮南院只收有起訖日期的展覽，跨當期與預告頁以官方詳情網址合併。

本機 `npm run sync:status` 可查最新嘗試、最近官方成功時間、七日來源工作數／最終失敗率／有重試的工作數、待審與新缺席待核對量。七日統計按 `sync_id` 的最後一次嘗試計，一次工作重試後成功只算一次成功。登入本機管理頁可開 `/health` 看中文摘要；兩者都是只讀報告。`npm run sync:failed -- --source <館別>` 只在該來源最近嘗試失敗時重跑。`sync_attempts` 是持久化嘗試日誌，直接 sync 仍可供本機手動使用，每日 workflow 改用來源 Queue；目前沒有主動告警。沒有嘗試紀錄也不能當作成功。

`last_success_at` 表示最後成功匯入時間，包括本機檔案及快照；`last_official_success_at` 只有 `--official` 成功匯入才更新。舊資料庫升級時，只用成功的 `sync_attempts` 回填可證明的官方同步時間；來源不明的舊匯入不推定為官方同步。`GET /museums` 綜合最近一次 `sync_attempts` 與最後官方同步時間回傳 `dataStatus`；特展頁選館後顯示狀態與館方連結。最近一次失敗優先顯示失敗，超過 7 天未成功取得官方來源顯示資料可能過期；手動重播舊快照不會解除過期提示。7 天是同步狀態提醒門檻，並非展覽內容的有效期限。奇美只標人工核對，本機靜態預覽只標展示快照。這是被動提示，**尚無自動告警**；現階段 workflow 失敗紀錄仍須人工檢查。

同館跨來源以官方詳情網址優先去重；不同網址只在展名、展廳相同且展期重疊時合併。來源別名保存在 `exhibition_sources`，欄位舊值與新值保存在 `exhibition_changes`，可從 `GET /exhibitions/:id/changes` 查詢。這不會把不同館的巡迴展誤併成同一場。若候選超過一筆，匯入失敗並等待人工判斷。

成功的 `--official` 匯入另會檢查先前公開、尚未結束、由同一 provider 主導的展覽是否未出現在本次來源鍵或官方網址清單中。缺席只記在 `source_missing_candidates`，並累計連續次數；重新出現或由另一有效來源接手就自動結案。可用 `npm run review -- --missing`，或登入本機管理頁後開 `/missing` 查官方原頁。**不要把候選當成館方取消公告**：部分來源可能分頁、漏資料或涵蓋率不完整；目前不自動下架，也沒有主動通知。空來源、全待審失敗批次和手動快照都不計算缺席。後續如要自動下架，須先逐來源證明清單完整性並定義人工複核規則。

人工核對缺席候選：登入 `npm run admin` 啟動的本機管理頁，開 `/missing`，點展覽進 `/missing/record`；先開官方原頁檢查，再填同網域 HTTPS 證據連結、審查人、說明及「核對後保留」或「需後續追查」。核對會記入 `source_missing_reviews`，但兩種結果都不改公開展覽。頁面顯示本次是否已核對；新一次成功官方同步仍缺席時會重新待核對。`npm run review -- --missing` 的 `needsReview` 可供命令列盤點。這些紀錄不是館方公告，也沒有自動通知。

條件式請求（ETag、`If-Modified-Since`）只在官方端實際提供標頭且驗證 `304` 行為後實作。奇美官網尚未確認可自動擷取與使用條件，不列入每日資料庫同步。

官方匯入若首次見到同館／provider 清單，只建立筆數基準，不做舊展缺席判斷；之後來源鍵或解析後展覽筆數由至少 4 筆跌至一半或更少、且至少少 2 筆時，`coverage_status=deferred_partial`，這次不新增或結案缺席候選。有效展覽仍會匯入，最後官方成功時間仍會更新。先查 `ingestion_runs` 的 `source_identity_count`、`source_row_count` 和兩個 `coverage_baseline_*` 欄位，再對照官方原頁；若來源真的永久縮小，目前需人工評估基準重設，沒有自動覆寫。詳見[完整度階段紀錄](stage-2026-10-10-source-coverage.md)。

## 本機 PostgreSQL 來源工作佇列

此功能需先 `npm run migrate`；本機可手動呼叫，每日 workflow 也已接入，但仍由閘門關閉，沒有線上運行證據。`npm run jobs:enqueue -- --source all` 以臺灣日期建立五館工作，也可指定單一館別和 `--date YYYY-MM-DD`；同館同日重送只回既有工作。`npm run jobs:work` 執行一筆到期工作；加 `-- --loop` 才會持續每五秒輪詢。可在不同終端機啟動多個 worker，PostgreSQL `SKIP LOCKED` 避免領到同一筆。`npm run jobs:status` 查看最近 100 筆。`dead` 工作先查錯誤和館方來源，再用 `npm run jobs:replay -- --id <UUID>` 建立新工作，原紀錄不刪。

每次工作最長執行官方匯入 90 秒，持有三分鐘租約；單次 `jobs:work` 若工作失敗會回傳非零碼。`npm run jobs:daily -- --source nstm` 只處理科工館當日工作，最長等待八分鐘並回報最終狀態；暫時失敗依退避時間等待，成功的同館同日工作不重抓，`dead` 回傳非零碼且不自動重播。等待逾時後用 `jobs:status` 查狀態；成功工作需要重新抓取時，明確改用 `npm run sync -- --source <館別>` 手動處理。暫時錯誤最多三次，間隔 30 秒、2 分鐘，非暫時錯誤直接進 `dead`。worker 異常中止時，下次領取會把過期租約記成失敗並安排退避；沒有常駐 worker 時不會自動恢復。這個 Queue 只處理 `FETCH_SOURCE`，資料解析、正規化、去重、異動仍在一次匯入交易內；不含訂閱通知或圖片處理。不要將「有 Queue」誤寫成已經有線上排程或 AWS 工作服務。

## 奇美每週變更檢查

`npm run check:chimei` 讀取官方 `robots.txt` 與公開特展頁，從初始 HTML 中的館方個別特展連結比對 `data/chimei-known-links.json`；另以間隔請求核對 `data/chimei-known-details.json` 內已知展覽的官方展名與完整展期。可用 `npm run check:chimei -- --file <本機HTML>` 離線驗證連結（離線模式不核對詳情）。`.github/workflows/chimei-check.yml` 設定每週一臺灣時間 09:20；目前受同一 `EVENT_RADAR_SYNC_ENABLED` 閘門保護，未啟用線上排程。新連結、既有連結消失、已知詳情不符、來源錯誤或解析不到連結都會讓檢查失敗；人工核對官方頁與資料庫後，才更新基準清單。

此檢查只能發現初始 HTML 明確連出的特展網址及已知展覽詳情變化，不能涵蓋由奇美官網內部介面動態載入的完整清單，也不能替代正式資料授權與匯入流程。不要將成功的檢查結果顯示為「奇美資料已同步」。
