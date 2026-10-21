# 每週同步運作設計

## 線上資料庫備份與隔離還原

在會改動正式 Neon 結構的部署前，先從已核對的 `DATABASE_URL` 建立 PostgreSQL custom-format 備份。工作站須有與伺服器主版本相容的 `pg_dump`／`pg_restore`；目前 Neon 是 PostgreSQL 18.6，不能使用 17.x 的 `pg_dump`。Windows 可用 PostgreSQL 官方連結的 EDB binaries，CI 的合成資料測試則使用 `postgres:17-alpine`。執行 `npm run backup:db` 後，程式預設將 `.dump` 寫到 Git 忽略的 `private/backups/`；本機專案位於 OneDrive，正式資料應先設定 `EVENT_RADAR_BACKUP_DIR` 為非 OneDrive 的個人本機目錄，例如 `%LOCALAPPDATA%\EventRadar\backups`。工具路徑可分別以 `PG_DUMP_BIN`、`PG_RESTORE_BIN` 指定。程式輸出檔案大小與 SHA-256；備份檔不可推送、貼到對話或上傳公開儲存空間。

**備份完成不等於可還原。**另建立空白且命名為 `event_radar_restore_*` 的隔離資料庫，將其連線設為 `RESTORE_DATABASE_URL`，執行 `npm run restore:check -- <備份檔路徑>`。程式僅接受所設備份目錄內的 `.dump`，拒絕正式庫名稱與非空白目標，使用單一交易還原，再核對 migration 帳本、館所、展覽與匯入批次的可讀筆數；不要對正式庫執行還原。演練後應另與備份時的來源筆數比對，記錄日期、檔案 SHA、還原結果及清理隔離庫的結果。`npm run test:backup` 只在本機 PostgreSQL／CI 隔離環境使用，會自建並刪除測試庫，**絕不可指向 Neon**。

2026-10-18 [CI #50](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/39101962456) 先備份並還原合成展覽、來源與異動關係。同日後續使用 PostgreSQL 18.6 原生工具完成正式 Neon 的**本機備份與隔離還原演練**：146,102 bytes、SHA-256 `8074b679838dc3ad83eb797db2540e9ad4403d2e4ddcddd366af67cbcf532222`，還原後 25 份 migration、11 間館、30 筆展覽及 18 筆匯入紀錄與來源唯讀筆數一致。臨時本機資料庫已停止並清除，備份保留在 `%LOCALAPPDATA%\EventRadar\backups`。這仍是一份單機、未加密、未驗證異地保存的備份；電腦或磁碟故障時可能一併遺失。詳見[演練紀錄](stage-2026-10-18-neon-backup-drill.md)。任何正式還原仍須另行確認停寫、目標、資料版本及回退方案，不能套用測試命令覆寫原庫。

## 週二排程驗收

每週二臺灣時間 04:15 後，逐一檢查 GitHub Actions 六個已啟用的來源工作：科博館、故宮南院、海生館限期展、科工館、國美館及歌劇院。對照 `npm run sync:status`、`npm run jobs:status`、網站 `/health` 與公開資料的最後成功時間；來源失敗時記錄工作名稱、錯誤種類、來源列數與待審數，不把前次成功誤記成當週成功。首次真實週排程預定 2026-10-20，第二次跨週完成前不宣稱穩定。故宮北院獨立開關維持關閉，按下節人工更新；海生館當日節目不是每週特展工作，不能用週排程宣稱今日節目已更新。

## 故宮北院雲端連線失敗時的更新

2026-10-18 本機從故宮官方 JSON 同步線上資料庫成功；GitHub runner 與 Render 先前仍只回報 `fetch failed`。2026-10-20 確認這份 JSON 已知缺少兩檔北院當期展。`EVENT_RADAR_NPM_NORTH_SYNC_ENABLED` 維持非 true。人工更新前先執行唯讀 `npm run probe:npm-north`；即使它因已知缺漏回傳非零碼，仍可在核對來源後用 `npm run ingest -- --source npm-north --official` 匯入合格資料，本次須記 `deferred_partial`，不可視為完整清單。兩筆已核對展覽另放在 `data/npm-north-verified-supplement.json`；使用前重新核對館方詳情與展期，再於已安全載入 `DATABASE_URL` 的維運工作站執行 `npm run ingest -- --source npm-north --provider npm-north-manual --file data/npm-north-verified-supplement.json`。其後用 `npm run sync:status` 及公開 API 核對，不得因其他展覽缺席就下架舊資料。不要將連線字串或密碼貼進終端紀錄、文件或 Git。此人工更新不表示北院週排程已恢復。

程式現在會記錄受限格式的網路錯誤代碼。PR #3 一次性 GitHub runner 唯讀測試得到 `UND_ERR_CONNECT_TIMEOUT`；尚未證明館方主動限制雲端來源。若考慮重新啟用自動同步，先向資料提供機關確認雲端可用的官方出口，再做隔離的雲端連線及跨週驗證。文化部展覽資料可用於交叉核對，但 2026-10-18 僅找到一筆相關展覽且未附故宮逐筆網址，不可直接替代故宮完整資料。

2026-10-21 已按上述流程備份、匯入兩筆人工補充、執行官方部分匯入，公開站顯示 3 筆北院展覽；下次重跑仍須逐筆核對，不把這份人工快照當作新展自動發現機制。操作結果見[上線驗證紀錄](stage-2026-10-21-npm-north-release.md)。

同日第二輪核對又確認四檔漏展，補充檔現含六檔。正式庫已有前兩筆，備份後匯入新增四筆、另兩筆未變；公開 API 回 `total=7`，含〈龍藏經〉及六筆補充。操作證據見[第二輪稽核](stage-2026-10-21-npm-north-second-audit.md)。往後重跑前仍須重新核對館方詳情與展期、確認備份及 `last_official_success_at` 不因人工補充推進。北院雲端週排程仍關閉；人工核對展覽的公開 `sourceStatus` 須為 `curated`。

## 國美館來源與每週接線

先在本機套用 `npm run migrate`，再以 `npm run probe:ntmofa` 只讀核對官方當期／預告清單與館內限期展，確認沒有異常待審後執行 `npm run sync -- --source ntmofa`。本來源讀國美館公開 HTML 及其連出的文化部 NTMOFA 詳情頁，沒有 API Key；已加入來源 Queue 與每週 workflow，2026-10-17 的線上手動執行成功。首次成功只建立 coverage 基準，下一次須比對來源鍵與館方頁，不能因清單缺席就自動認定展覽取消。

## 表演與海洋節目手動同步（Phase 3／4）

海生館 2026-10-15 官網當日清單本機同步接受 9 筆、均未變。特別開館與每日節目分開核對：只有館方服務或公告頁**明示指定日期**時，站長才執行 `npm run review:marine-opening -- set --date YYYY-MM-DD --status open --opens HH:MM --closes HH:MM --evidence <官方 HTTPS 頁> --reviewer <姓名> --note <20–500 字核對說明>`；休館改用 `--status closed`，不可附時間。對照官方日期與公告全文後再寫入；命令會留下異動史，同內容重跑不重複記錄。沒有證據的日期 API 維持 `unknown`。相關判斷及實測見[Phase 4 階段紀錄](stage-2026-10-15-phase4.md)。

第 023 migration 後，每次成功的海生館當日節目同步也會在同一交易寫入完整日期快照。可先查 `/marine-observation-days`，再查 `/marine-programmes?date=YYYY-MM-DD` 對照該日最後接受的版本；同日 `versionCount` 增加代表曾接受不同內容，需對照館方頁與匯入紀錄判斷原因。`SOURCE_ANOMALY` 失敗時不會留下快照，不應手動改歷史清單來使前端看似正常。快照僅從新版本上線後累積，舊日期未回填；歷史時段不能作為今日行前保證。

第 024 migration 起，海生館官方當日清單成功批次會保存排序後的來源鍵。若相對上次成功清單突然少於一半（基準至少 4 筆），或前後至少各 4 筆且重疊來源鍵少於較小清單的一半，`sync:domain` 會以 `SOURCE_ANOMALY` 拒收，保留最近成功資料與快照。**先打開[館方當日節目頁](https://www.nmmba.gov.tw/ActiveShow_D_Cus.aspx?n=33D045D1594ED637&sms=00C15C8CDECA96C3)逐項核對**：若確認是正常特殊日／換季變動，再執行 `npm run sync:domain -- --source nmmba --review-daily-change "20–500 字核對說明" --review-evidence "<實際官方 HTTPS 證據網址>" --reviewer "核對者"`。覆核只接受官方 HTTPS 網址，不能與 `--snapshot` 並用；沒有達到異常條件時不得附覆核參數。成功批次留下說明、證據網址、核對者、來源鍵與完整快照。程式驗證網址屬館方網域，**不會自動驗證該頁內容確實支持覆核結論**，操作人必須人工查證。先前成功批次沒有來源鍵時，下一次正常官方同步才建立首次鍵基準；不得回填或猜測。

這是獨立於限期特展的 `sync:domain` 路徑；歌劇院已加入獨立的每週 workflow 工作，2026-10-17 線上手動執行成功；跨週排程仍待觀察。海生館當日節目仍手動同步，兩者均不進限期展 Queue。先核對來源頁與 [Phase 3／4 階段紀錄](stage-2026-10-12-phase3-4.md)，再用 `npm run sync:domain -- --source ntt` 或 `--source nmmba` 手動執行。歌劇院涵蓋官網 `place=1` 清單 HTML 的可辨識詳情，包含 MORE 預藏卡片；單批最多 30 筆，MORE 行為改變時停止，不能當作全站所有節目。單一詳情或人工快照另有 `--detail`／`--snapshot` 模式，不能當作完整清單。海生館只取得館方當日節目，日期、場次數、時刻與地點必須可核對；筆數突然大幅縮水會以 `SOURCE_ANOMALY` 停止，先到官網確認，不應反覆重跑來消除異常。公開 `/marine-programmes` 只顯示最近一次成功匯入批次；觀察日不是今天時不能當作今日節目。相關單元測試及隔離 PostgreSQL／真實 HTTP 整合案例已於 2026-10-14 通過；當日第二次歌劇院真實手動同步接受 20 筆（新增 1、未變 19）。

`sync:domain` 的官方 HTML 請求每次逾時 15 秒，只對逾時／網路錯誤與 HTTP 5xx 最多再試兩次，間隔 2 秒、8 秒；404、429、非館方網址／回應主機、解析失敗或資料過大立即失敗。歌劇院不同詳情之間仍另有兩秒間隔。失敗訊息包含官方失敗網址與嘗試次數，便於人工核對；重試耗盡仍不寫入不完整批次。

歌劇院詳情若標題或「作品簡介」醒目公告明示取消、延期、場次異動，該節目的場次先標為 `unknown`，不進預設「即將演出」；同批其他節目可繼續同步。這不會從公告文字猜哪一場受影響。執行 `npm run review:performance -- pending` 可列出未來待核對場次；逐場對照館方詳情或官方新聞後，以 `npm run review:performance -- set --source-key <c-...> --starts-at <含時區 ISO 時間> --status <scheduled|sold_out|cancelled|postponed|unknown> --evidence <同節目官方詳情或館方新聞 HTTPS 網址> --reviewer <核對者> --note <20–500 字說明>` 保存結果。`sourceKey`、`startsAt` 可從 `GET /performances?period=all` 或 `pending` 輸出取得。人工核對有證據網址、核對時間與 `domain_event_changes` 紀錄；相同內容重跑不重複記錄，**來源內容未改變**時再次同步保留人工狀態。若官方內容改版，舊結論失效：原本人工狀態轉為 `unknown`（官網明確全額滿則轉為 `sold_out`），須重新核對；若原場次從詳情消失，同樣回到 `unknown`，不得推定取消。這個保護只涵蓋已確認的公告位置；站長仍應核對官網與售票頁。

若館方整個節目的報名按鈕明確顯示「已額滿（需後補）」或「售罄／完售」，Adapter 會把該頁的場次標為 `sold_out`。僅一部分場次額滿、或內文提到過去節目完售時不套用；尚未取得可靠的逐場即時票務介面，`scheduled` 永遠不代表有票。

歌劇院官方 `place=1` 清單另記為 `ntt_place1_list`，不和 `--snapshot`／`--detail` 的抽樣互相比。前次成功至少 10 筆、這次不足一半，或前後清單至少各 10 筆且重疊來源鍵少於較小清單的一半時，會以 `SOURCE_ANOMALY` 整批停止，原有節目不被改寫。第 019 migration 起，官方批次的來源鍵存於 `domain_source_runs.identity_keys`；舊批次沒有鍵時，必須先成功同步一次才能建立比對基準。先開啟[館方清單](https://www.npac-ntt.org/program/events?place=1)核對換季、活動落幕與詳情連結；若確認可接受，執行 `npm run sync:domain -- --source ntt --review-list-change "已核對館方清單及逐筆詳情，確認節目與連結變動屬正常換季。"`。原 `--review-shrink` 參數仍可使用。說明須 20–500 字，記入 `domain_source_runs.review_note`；只有觸發異常時可用，不要寫入機密資訊。人工覆核不代表缺席節目自動取消，也不會刪除舊資料。

本機執行整合測試前，先以 `docker compose port db 5432` 查實際映射埠，確認 `.env` 的 `DATABASE_URL` 使用同一埠；測試腳本會建立獨立 `event_radar_it_*` 資料庫，最後刪除該測試庫，不使用或清空一般 `event_radar` 資料庫。

目標頻率為臺灣時間每週二 04:15；博物館特展不需要每天讀取。排程在非整點，降低 GitHub Actions 整點壅塞機率；它仍可能延遲或漏跑，不能承諾準點更新。重要展期變動可手動執行單館同步。來源資料本身若未更新，重跑只刷新最後看見時間。

`.github/workflows/weekly-sync.yml` 已有 2026-10-17 線上手動執行證據，也有 [2026-10-20 第一次真實週排程](stage-2026-10-21-first-weekly-schedule.md)：六個獨立工作成功，故宮北院依開關略過。`EVENT_RADAR_SYNC_ENABLED` 啟用已驗證來源；北院另由 `EVENT_RADAR_NPM_NORTH_SYNC_ENABLED` 控制（目前應維持非 true），奇美只讀檢查另由 `EVENT_RADAR_CHIMEI_CHECK_ENABLED` 控制（目前應維持非 true）。**只有一次真實週排程，跨週可靠性仍待觀察。**初次啟用或重建環境的檢查條件：

1. 專案放到獨立 GitHub repo 的預設分支。
2. 建立可從 GitHub Actions 連線的 PostgreSQL；**空白庫**執行 `npm run migrate` 即可。既有且已有 migration 帳本的資料庫也直接執行此命令，會套用尚未執行的版本（目前至 025）。若沿用早期手動建表、完全沒有帳本的舊庫，先備份並核對所有 migration 都已套用，再執行一次 `npm run migrate -- --baseline-existing`；結構缺漏會拒絕，不能用基線命令跳過真正缺少的 migration。
3. Repository secrets 設 `DATABASE_URL` 與 `NMNS_API_KEY`。後者只在決定啟用線上同步時設定，切勿寫入程式碼、文件或 workflow 日誌；`NMNS_OPEN_DATA_URL` 可作展覽匯入的無金鑰備援，不能提供逐日開放時間。
4. Repository variable 設 `EVENT_RADAR_SYNC_ENABLED=true`，先手動執行一次並確認 `ingestion_runs` 與 `/health`，才依排程運作。

每週同步 workflow 定義六個限期展工作與一個歌劇院工作；北院工作另有獨立閘門。每個限期展工作使用 `jobs:scheduled` 建立同館當日 Queue 工作，只領取自己的 job ID，等待重試後的最終結果；這條執行路徑已於 2026-10-17 在線上手動執行，其中北院失敗。六個限期展來源為：科博館官方 OpenAPI（有 Key 時優先；公開 JSON 備援）、故宮南院官方當期／預告頁、故宮北院公開 JSON、海生館公開 JSON、科工館公開 JSON 加官方特展列表核對、國美館公開 HTML 與文化部詳情頁。文化部奇美資料目前只在本機手動匯入，因官方 OpenAPI 未確認分頁及完整涵蓋率。匯入先驗證來源，再在交易中寫入；來源為空、頁面格式改變或寫入錯誤時記失敗，`last_success_at` 不前進。逐筆可隔離的品質問題會存原始紀錄；若整批 **0 筆可公開展覽**，保留原始／待審資料、記失敗並回傳非零碼，不把這次嘗試當成成功同步。有有效展覽但部分待審時仍可成功。故宮南院只收有起訖日期的展覽，跨當期與預告頁以官方詳情網址合併。

本機 `npm run sync:status` 可查最新嘗試、最近官方成功時間、七日來源工作數／最終失敗率／有重試的工作數、待審與新缺席待核對量。七日統計按 `sync_id` 的最後一次嘗試計，一次工作重試後成功只算一次成功。登入本機管理頁可開 `/health` 看中文摘要；兩者都是只讀報告。`npm run sync:failed -- --source <館別>` 只在該來源最近嘗試失敗時重跑。`sync_attempts` 是持久化嘗試日誌，直接 sync 仍可供本機手動使用，每週 workflow 改用來源 Queue；目前沒有主動告警。沒有嘗試紀錄也不能當作成功。

`last_success_at` 表示最後成功匯入時間，包括本機檔案及快照；`last_official_success_at` 只有 `--official` 成功匯入才更新。舊資料庫升級時，只用成功的 `sync_attempts` 回填可證明的官方同步時間；來源不明的舊匯入不推定為官方同步。`GET /museums` 綜合最近一次 `sync_attempts` 與最後官方同步時間回傳 `dataStatus`；特展頁選館後顯示狀態與館方連結。最近一次失敗優先顯示失敗，超過 14 天未成功取得官方來源顯示資料可能過期；手動重播舊快照不會解除過期提示。14 天是每週排程漏跑一次後的提醒門檻，並非展覽內容的有效期限。奇美只標人工核對，本機靜態預覽只標展示快照。這是被動提示，**尚無自動告警**；現階段 workflow 失敗紀錄仍須人工檢查。

同館跨來源以官方詳情網址優先去重；不同網址只在展名、展廳相同且展期重疊時合併。來源別名保存在 `exhibition_sources`，欄位舊值與新值保存在 `exhibition_changes`，可從 `GET /exhibitions/:id/changes` 查詢。這不會把不同館的巡迴展誤併成同一場。若候選超過一筆，匯入失敗並等待人工判斷。

成功的 `--official` 匯入另會檢查先前公開、尚未結束、由同一 provider 主導的展覽是否未出現在本次來源鍵或官方網址清單中。缺席只記在 `source_missing_candidates`，並累計連續次數；重新出現或由另一有效來源接手就自動結案。可用 `npm run review -- --missing`，或登入本機管理頁後開 `/missing` 查官方原頁。**不要把候選當成館方取消公告**：部分來源可能分頁、漏資料或涵蓋率不完整；目前不自動下架，也沒有主動通知。空來源、全待審失敗批次和手動快照都不計算缺席。後續如要自動下架，須先逐來源證明清單完整性並定義人工複核規則。

人工核對缺席候選：登入 `npm run admin` 啟動的本機管理頁，開 `/missing`，點展覽進 `/missing/record`；先開官方原頁檢查，再填同網域 HTTPS 證據連結、審查人、說明及「核對後保留」或「需後續追查」。核對會記入 `source_missing_reviews`，但兩種結果都不改公開展覽。頁面顯示本次是否已核對；新一次成功官方同步仍缺席時會重新待核對。`npm run review -- --missing` 的 `needsReview` 可供命令列盤點。這些紀錄不是館方公告，也沒有自動通知。

條件式請求（ETag、`If-Modified-Since`）只在官方端實際提供標頭且驗證 `304` 行為後實作。奇美官網尚未確認可自動擷取與使用條件，不列入每週資料庫同步。

官方匯入若首次見到同館／provider 清單，只建立筆數與來源鍵基準，不做舊展缺席判斷；之後來源鍵或解析後展覽筆數由至少 4 筆跌至一半或更少、且至少少 2 筆時，`coverage_status=deferred_partial`。即使筆數不減，若上次至少 4 筆中至少 3 筆消失、且本次與上次重疊不超過四分之一，也同樣暫緩。這次不新增或結案缺席候選，也不因本批待審資料隱藏舊展；有效展覽仍會匯入，最後官方成功時間仍會更新。先查 `ingestion_runs` 的 `source_identity_count`、`source_row_count`、兩個 `coverage_baseline_*` 欄位與 `official_source_baselines.identity_keys`，再對照官方原頁。舊版筆數基準的 `identity_keys` 為 `NULL`，下一次通過筆數檢查的官方同步才建立鍵清單。真正的季節輪替也可能觸發警示；系統不會自動覆寫異常基準，須人工評估。詳見[完整度階段紀錄](stage-2026-10-10-source-coverage.md)與[來源鍵階段紀錄](stage-2026-10-11-source-identity-coverage.md)。

若確認是館方真正換季或清單調整，可先執行 `npm run coverage:baseline -- inspect --source nstm`；有多個 provider 時加 `--provider <來源>`。先確認 `coverageStatus=deferred_partial`、`canAccept=true`，比較 `removedKeys`／`addedKeys`、來源數與官方列表及展覽詳情。核對完成後執行 `npm run coverage:baseline -- accept --source nstm --run <inspect 顯示的 UUID> --evidence <該館 HTTPS 官方頁> --reviewer <姓名> --note <核對依據>`。操作會記錄在 `source_baseline_reviews` 並更新比較基準；若已有新官方批次、比較基準已改、來源鍵快照缺漏或證據網域不符，會拒絕。**這不會下架或隱藏舊展，也不代表舊展已取消**；下一次成功官方同步才重新評估完整度及缺席候選。人工核准不會回改歷史 `deferred_partial` 狀態。需檢查官方頁與新舊展覽後再考慮個別缺席核對，切勿為了清除警示而直接核准。

## 本機 PostgreSQL 來源工作佇列

此功能需先 `npm run migrate`；本機可手動呼叫，每週 workflow 已啟用已驗證來源，2026-10-17 線上手動執行與 10/20 第一次真實週排程的六個工作成功；第二次週排程仍待觀察。故宮北院雲端抓取失敗，另由預設關閉的 `EVENT_RADAR_NPM_NORTH_SYNC_ENABLED` 隔離，不算入六個成功工作。`npm run jobs:enqueue -- --source all` 以臺灣日期建立六館工作，也可指定單一館別和 `--date YYYY-MM-DD`；同館同日重送只回既有工作。`npm run jobs:work` 執行一筆到期工作；加 `-- --loop` 才會持續每五秒輪詢。可在不同終端機啟動多個 worker，PostgreSQL `SKIP LOCKED` 避免領到同一筆。`npm run jobs:status` 查看最近 100 筆。`dead` 工作先查錯誤和館方來源，再用 `npm run jobs:replay -- --id <UUID>` 建立新工作，原紀錄不刪。

每次工作最長執行官方匯入 90 秒，持有三分鐘租約；單次 `jobs:work` 若工作失敗會回傳非零碼。`npm run jobs:scheduled -- --source nstm` 只處理科工館當日工作，最長等待八分鐘並回報最終狀態；暫時失敗依退避時間等待，成功的同館同日工作不重抓，`dead` 回傳非零碼且不自動重播。等待逾時後用 `jobs:status` 查狀態；成功工作需要重新抓取時，明確改用 `npm run sync -- --source <館別>` 手動處理。暫時錯誤最多三次，間隔 30 秒、2 分鐘，非暫時錯誤直接進 `dead`。worker 異常中止時，下次領取會把過期租約記成失敗並安排退避；沒有常駐 worker 時不會自動恢復。這個 Queue 只處理 `FETCH_SOURCE`，資料解析、正規化、去重、異動仍在一次匯入交易內；不含訂閱通知或圖片處理。不要將「有 Queue」誤寫成已經有線上排程或 AWS 工作服務。

## 奇美每週變更檢查

`npm run check:chimei` 讀取官方 `robots.txt` 與公開特展頁，從初始 HTML 中的館方個別特展連結比對 `data/chimei-known-links.json`；另以間隔請求核對 `data/chimei-known-details.json` 內已知展覽的官方展名與完整展期。可用 `npm run check:chimei -- --file <本機HTML>` 離線驗證連結（離線模式不核對詳情）。`.github/workflows/chimei-check.yml` 設定每週一臺灣時間 09:20；目前由獨立的 `EVENT_RADAR_CHIMEI_CHECK_ENABLED` 閘門保護，未驗證線上排程。新連結、既有連結消失、已知詳情不符、來源錯誤或解析不到連結都會讓檢查失敗；人工核對官方頁與資料庫後，才更新基準清單。

此檢查只能發現初始 HTML 明確連出的特展網址及已知展覽詳情變化，不能涵蓋由奇美官網內部介面動態載入的完整清單，也不能替代正式資料授權與匯入流程。不要將成功的檢查結果顯示為「奇美資料已同步」。
