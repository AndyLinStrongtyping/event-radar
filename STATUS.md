# Event Radar｜目前進度

2026-10-21 **第一次真實週二自動更新已核對**：[GitHub Actions #39343053279](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/39343053279)於 10/20 臺灣時間 07:40 啟動，六個獨立工作均成功，故宮北院依開關略過。各來源此次均無新增或更新；國美館取 9 筆、清單基準 10，標為 `deferred_partial`；海生館取 30 筆，其中 25 筆待審。**工作成功不等於完整涵蓋，跨週穩定仍待第二次真實排程**。化石館展覽來源也已盤點：左鎮官網特展頁沒有完整展期，澎湖重新開館展示沒有可核對的獨立限期展日期，兩館不進當期特展搜尋。見[排程與來源核對](docs/stage-2026-10-21-first-weekly-schedule.md)。

2026-10-21 **桌面快速跳轉避開特展查詢**：約 1,265px 寬視窗原本的右側文字導覽覆蓋館所選單及「重新查詢」。在 1,050～1,799px 改成 40px 圖示列，保留各區特色圖示、中文無障礙名稱與滑鼠提示；本機與 [公開快速前端](https://andylinstrongtyping.github.io/event-radar/#explore-title) 均確認按鈕完整露出，本機實際點擊成功。1,800px 以上保留文字版，手機沿用原有版型。[PR #10](https://github.com/AndyLinStrongtyping/event-radar/pull/10) 的兩項檢查通過並已合併，Pages 第 12 次發布成功。見 [ER-97](docs/technical-decisions.md)。

2026-10-21 **故宮北院第二輪漏展已補入正式資料**：逐頁核對官方當期／預告清單與 4 檔詳情頁，發現〈匯流1950〉、〈物華再現〉、〈獨具慧眼〉、〈國寶聚焦 2026-III〉均未列於可取得的官方 JSON。PR [#9](https://github.com/AndyLinStrongtyping/event-radar/pull/9) 兩項 CI 通過後合併；正式 Neon 備份後匯入六筆補充資料，新增 4 筆、既有 2 筆未變，公開 API 顯示北院共 7 筆。PR [#10](https://github.com/AndyLinStrongtyping/event-radar/pull/10) 修正人工補展的來源標籤，Render 部署 `3db2f41` 上線後公開 API 核對為六筆 `curated`、一筆 `open_data`。**這六檔是人工核對補漏，不代表故宮清單已完整；北院雲端週排程仍關閉。**見[第二輪稽核](docs/stage-2026-10-21-npm-north-second-audit.md)與[ER-96](docs/technical-decisions.md)。

2026-10-21 **故宮北院部分涵蓋與人工補充已上線**：官方 JSON 已知漏展時，合格資料仍可匯入，來源標為 `deferred_partial`，不更新完整清單基準、官方完整同步時間或依缺席下架舊展。兩檔人工補充資料與故宮官方新聞核對；隔離 PostgreSQL 實測首次新增 2 筆、重跑 0 筆新增，79 項單元、型別、完整整合測試與文件檢查通過。PR [#7](https://github.com/AndyLinStrongtyping/event-radar/pull/7) 的 2 項 CI 檢查通過後合併，Render 部署 `e543883` 成功；Neon 備份後人工補充新增 2 筆，官方清單 22 筆中 1 筆合格、15 筆待審、6 筆略過，標記部分涵蓋；公開 API 已讀到兩檔補充展覽。**故宮北院雲端週排程仍關閉，並非自動完整來源**。見 [上線驗證紀錄](docs/stage-2026-10-21-npm-north-release.md)、[ER-96](docs/technical-decisions.md) 與 [來源稽核](docs/stage-2026-10-20-open-data-audit.md)。

2026-10-19 **快速前端已公開並完成跨來源驗收**：[GitHub Pages 快速入口](https://andylinstrongtyping.github.io/event-radar/)提供 React、CSS、JavaScript 與 28 張公開圖片；資料查詢仍使用既有 Render 唯讀 API，館所介紹仍回到 canonical Render 網址。第一次 Pages 工作因儲存庫未啟用而停在 `configure-pages`；網頁設定改為 GitHub Actions 後，重跑 [Pages #1 attempt 2](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/39191373569) 成功。CI [#64](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/39191373507) 通過含 CORS 的隔離 PostgreSQL／HTTP 契約，Render 手動部署 `9de79ed` 顯示 Live。公開檢查確認 Pages、主圖、Render API 都回 200，CORS 為 `*`，11 間館所、25 筆未結束特展，`/health` 與資料庫皆為 `ok`；Chrome 實際載入 25 場結果。Pages 以 `noindex,follow` 並 canonical 回 Render，避免重複搜尋頁。這項拆分讓介面與圖片不受 Render 休眠拖延，但資料仍需等待免費後端喚醒，不等於全站高可用。完整背景、問題處理與後續界線見[2026-10 完整開發復盤](docs/development-retrospective-2026-10.md)；技術取捨見 [ER-95](docs/technical-decisions.md)。

2026-10-18 **正式 Neon 備份及本機隔離還原已驗證**：以與 Neon PostgreSQL 18.6 相容的原生工具產生 custom-format 備份，保存在非 OneDrive 的本機 `%LOCALAPPDATA%\EventRadar\backups`，大小 146,102 bytes、SHA-256 `8074b679838dc3ad83eb797db2540e9ad4403d2e4ddcddd366af67cbcf532222`。還原到僅綁定 `127.0.0.1` 的臨時空白庫後，25 份 migration、11 間館、30 筆展覽、18 筆匯入紀錄與 Neon 即時唯讀筆數相符；臨時庫已停止並清除，備份保留。`EVENT_RADAR_BACKUP_DIR` 可讓備份離開 OneDrive。這是**單次本機還原演練**，尚非加密異地備份或持續復原保障；詳見[演練紀錄](docs/stage-2026-10-18-neon-backup-drill.md)及[ER-94](docs/technical-decisions.md)。

2026-10-18 **Phase 10 備份／還原流程先通過 CI 隔離演練**：新增 PostgreSQL custom-format 備份命令與隔離空白庫還原檢查；程式拒絕正式資料庫或非空白目標。單元測試 74 項及型別、文件檢查通過；[CI #50](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/39101962456) 用 PostgreSQL 17 實際備份並還原合成資料，25 份 migration、11 間館、1 筆展覽、1 筆匯入及展覽來源／異動關係比對成功。當時工作站還沒有 `pg_dump`，**此筆 CI 證據不代表正式 Neon 已備份**；正式資料的後續驗收見上方紀錄。首次真實週二排程仍待 10/20 驗收；詳見[運作手冊](docs/operations.md)及[ER-94](docs/technical-decisions.md)。

2026-10-18 **故宮北院已由本機重新同步線上資料庫，雲端自動抓取仍隔離**：同一個 Node 官方 JSON 來源在本機回 HTTP 200；重跑 `sync -- --source npm-north` 取得 22 筆，1 筆可公開且內容未變、15 筆待審、6 筆略過，coverage 與 22 筆基準一致。GitHub runner 的一次性唯讀診斷確定 `UND_ERR_CONNECT_TIMEOUT`，即連線逾時；不能據此斷定館方封鎖。文化部公開展覽資料當日僅比對到 1 筆同名同展期故宮展，且未附故宮逐筆網址，不能直接取代故宮完整官方清單。已加入安全的網路錯誤代碼診斷，北院獨立排程開關繼續關閉。見 [ER-93](docs/technical-decisions.md)。

2026-10-17 **流量監測與資料庫憑證核對**：線上首頁和館所介紹頁均載入 GA4；公開站兩次測試造訪在即時總覽產生 `page_view=2`、`session_start=1`。這是自己的測試流量，尚不能當成真實訪客數；Search Console 已處理 15 個固定頁面，但仍待正式索引。已用本機有效密碼修正 GitHub Actions、Render 及 Git 忽略檔中的舊資料庫連線網址，不需重設 Neon 密碼；Render 重新部署後 `/health` 為 `status=ok, database=ok`。見 [ER-90／91](docs/technical-decisions.md)。

2026-10-17 **每週來源已通過手動驗證，尚待實際週排程**：手動 Actions [#3](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/39032657980) 中，科博館、故宮南院、海生館、科工館、國美館與歌劇院六個獨立工作成功。故宮北院官方開放資料網址從 GitHub runner 連續三次 `fetch failed`，而本機先前可匯入；已用獨立開關暫停北院雲端排程，保留人工同步與來源狀態提示。奇美檢查也改用獨立開關。合併後手動 Actions [#4](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/39033250246) 六工作成功、北院依設定略過。**實際週二觸發與跨週穩定尚未證明**；見 [ER-91](docs/technical-decisions.md)。

2026-10-18 **長頁面回頂已部署並通過公開站瀏覽器驗收**：首頁與 14 篇館所介紹頁已加入下滑後出現的浮動回頂按鈕。PR [#2](https://github.com/AndyLinStrongtyping/event-radar/pull/2) 合併且 CI 通過後，因 Render 自動部署關閉，手動部署主分支 `52d803c`。公開首頁及澎湖化石館導覽頁均實測從長頁面回到 `scrollY=0`、按鈕隱藏；新版 React 資源已載入，`/health` 回 `status=ok, database=ok`。型別、React 建置與文件檢查通過；**手機實機手感及其餘 13 篇頁面仍待抽查**。見 [ER-92](docs/technical-decisions.md)。

2026-10-17 **Google Search Console 已完成連接**：以首頁 HTML 標記驗證 `https://event-radar-preview.onrender.com/` 的網站擁有權。Render 部署 `b265c1b` 顯示 Live，`PUBLIC_BASE_URL` 已啟用，公開站 smoke 確認沒有 `noindex` 且 `robots.txt`、`sitemap.xml` 可用。Google 已順利處理 sitemap，發現 15 個固定頁面；首頁即時測試判定可編入索引，已接受建立索引要求，但 Google 索引中仍未有此頁。**尚無搜尋曝光、點擊或直接分享流量的數據**；見[ER-89](docs/technical-decisions.md)。

2026-10-17 **每週線上更新首次接線時的狀態（已由上方新紀錄更新）**：六個限期展來源（含國美館）已接入各自的 PostgreSQL 來源工作；臺中國家歌劇院另有獨立的每週節目同步工作。當時科博館 API Key 與 Neon `DATABASE_URL` 已存 GitHub Actions Secrets，`EVENT_RADAR_SYNC_ENABLED` 仍關閉；其後的實際手動執行與來源例外見上方 2026-10-17 紀錄。型別及 72 項單元測試、workflow 格式檢查與 GitHub CI #28 均通過；本機隔離 PostgreSQL 未啟動，新增 Queue 整合案例由 CI 驗證。奇美仍是人工核對候選來源，海生館當日節目不能用每週資料當成今日資訊；見[ER-88／91](docs/technical-decisions.md)與[運作設計](docs/operations.md)。

2026-10-17 **Phase 9 免費技術預覽已上線並完成單次驗收**：[預覽站](https://event-radar-preview.onrender.com/)部署 `8d78297`，Render 顯示 Live；Neon production 已套用 25 份 migration。首次建置時 Render 對故宮北院來源連續三次 `fetch failed`，故改由本機以既有同步命令連到 Neon，完成故宮北／南院、科博館、科工館、海生館、國美館六個限期展來源，以及海生館當日節目 9 筆、歌劇院清單 20 筆；奇美人工核對活動快照 10 筆存入候選表。線上 smoke 通過：11 間館所、27 筆可搜尋且未結束的特展，React、API、照片與健康檢查正常。**目前仍是 `noindex` 的公開預覽，不代表搜尋收錄、真實流量、跨日穩定或正式排程已完成**；北院 15、海生館 25、科工館 1 筆資料待審。憑證存在 Render Secret 與本機 Git 忽略的 `private/`；見[ER-86／87](docs/technical-decisions.md)與[部署手冊](docs/deployment.md)。

2026-10-16 **Phase 9 部署前本機準備完成，尚未部署**：已加入 Render 免費技術預覽範本、Node 版本固定、正式啟動命令、可控的 `HOST`／`PORT`、首頁與館所頁的 canonical／sitemap、預覽禁索引，以及唯讀部署後 smoke 腳本。型別、72 項單元、React build、隔離 PostgreSQL／HTTP 整合與本機 smoke 通過。Neon／Render 建立、遠端 migration 與官方資料匯入、公開網址、線上觀測及搜尋收錄都尚待站長登入後執行；**不能把本機驗證當成線上運作證據**。見[部署手冊](docs/deployment.md)、[Phase 9 準備紀錄](docs/stage-2026-10-16-phase9-prep.md)與[ER-85](docs/technical-decisions.md)。

2026-10-16 **Phase 8 文件與作品集整理完成**：README 以現有領域及來源等級重寫入口，架構圖補表演／海洋節目路徑，新增主要實際外鍵的[ERD](docs/erd.md)與[面試用專案介紹](docs/portfolio-brief.md)；來源盤點、API 路由清單、路線圖及技術決策同步。這是文件階段，**未新增公開部署、線上流量、自動沖繩來源或 production Queue**。驗證及殘留限制見[Phase 8 驗收](docs/stage-2026-10-16-phase8.md)和[ER-84](docs/technical-decisions.md)。

2026-10-16 修正本機化石館照片破圖：4101 原本是尚未載入化石圖片路由的舊服務，已核對並重新啟動 Event Radar。另補齊 `preview.cjs` 的兩館介紹及圖片路由，避免改用預覽模式時再次破圖。瀏覽器實測澎湖、左鎮各兩張圖鑑照片、兩篇館所介紹主圖與館所圖鑑卡片皆可載入；見 [ER-83](docs/technical-decisions.md)。

2026-10-16 潘氏澎湖鱷圖鑑與澎湖化石館卡片改用澎湖縣政府 2025 年展場照片，來源及網站資料開放宣告可查；原本的線條示意不再作主圖。圖片僅證明當時展場紀錄，不代表今日展件狀態。見 [ER-82](docs/technical-decisions.md) 與 [照片署名](web/photo-credits.html)。

2026-10-16 Phase 7 現有功能的本機工程品質驗收完成：72 項單元、型別、React build、隔離 PostgreSQL／HTTP 整合及公開 GET OpenAPI 契約通過。Migration 新增連號與帳本前綴檢查，整合測試驗證未知版本、缺版、checksum 異動會拒絕繼續更新。CI 已設定同等命令，但此處未聲稱 GitHub 當次 run、外站跨週穩定或尚未接入來源的完整覆蓋。見[Phase 7 驗收紀錄](docs/stage-2026-10-16-phase7.md)與[ER-81](docs/technical-decisions.md)。

2026-10-16 深海探勘改成與化石專區一致的雙館按鈕切換。屏東海生館與沖繩美麗海一次只顯示一館；海生館的限期展、當日節目、歷史快照與生物圖鑑，及沖繩的核心常設展區、人工核對節目與生物圖鑑均保留。沖繩舊錨點可直接打開正確館別，手機版按鈕改為直排。這只改 React 呈現，不變更資料來源或自動同步狀態；見 [ER-80](docs/technical-decisions.md)。

2026-10-16 新增獨立「化石探勘」專區與澎湖化石館、臺南左鎮化石園區兩篇館所介紹。React 可切換兩館，閱讀核心常設展區、行前資訊與各兩筆化石圖鑑；四張 Wikimedia Commons 照片具署名／授權，潘氏澎湖鱷起初採明標「非標本照片」的本站輪廓示意，後續已依 ER-82 換成縣府照片。澎湖文化局兩處官網對週二是否開館有衝突，頁面明示需再核對；布氏鯨骨骼不算化石。兩館目前**只有人工整理的靜態導覽，沒有自動來源、即時活動、票務或指定日開館判定**，也未列入通用特展搜尋。72 項單元、型別、React build 與隔離 PostgreSQL／HTTP 整合測試通過；見[ER-79](docs/technical-decisions.md)、[照片署名](web/photo-credits.html)。

2026-10-16 深海探勘補上五張生物照片（各標示館內過往紀錄或外地物種示意、原圖與授權），沖繩區新增珊瑚之海 3F、黑潮之海 2F、深海 1F 的核心常設展區導覽。仍屬靜態館方資料整理，**沖繩尚未自動匯入，活體也不保證當日展出**。72 項單元、型別、React build 與隔離 PostgreSQL／HTTP 整合測試通過，五張照片路由皆可載入。見[ER-78](docs/technical-decisions.md)與[照片署名](web/photo-credits.html)。

2026-10-16 深海探勘擴充本機完成：畫面分為屏東海生館與沖繩美麗海兩區。海生館限期展由既有展覽 API 顯示在深海區，每日節目仍依成功匯入觀察日；兩館各有館方生物圖鑑入口（屏東三組、沖繩兩組）。沖繩另有靜態館所圖鑑、黑潮餵食與海豚劇場的 2026/10/16 人工核對時刻、照片授權與官方連結；**尚未自動匯入沖繩來源，也未將它混成海生館每日快照**。72 項單元、型別、React build 與隔離 PostgreSQL／HTTP 整合測試通過；本機瀏覽器核對到兩檔海生館限期展及沖繩節目區，見[ER-77](docs/technical-decisions.md)。

2026-10-16 Phase 6 本機模型收斂：表演與海洋節目的 OpenAPI 回應改以 `oneOf` 分型，各查詢端點只接受自己的領域；契約測試會拒絕錯領域資料、錯置日期或另一種時間欄位。這不改變 API JSON；第 025 migration 與匯入入口的領域保護仍維持。現有臺灣領域模型已完成盤點與本機驗證；**跨領域搜尋、沖繩來源、公開部署都未完成**。見[模型文件](docs/domain-model.md)與[ER-76](docs/technical-decisions.md)。

2026-10-15 Phase 6 匯入邊界續作：`importDomainEvents` 現在會在建立批次紀錄前拒絕未知來源、歌劇院／海生館來源與領域錯配；隔離整合測試確認錯誤輸入沒有留下匯入批次。與第 025 migration 的資料庫外鍵形成兩層保護。這只涵蓋目前兩個 Domain Adapter，新增來源仍需明確擴充入口契約；見 [ER-75](docs/technical-decisions.md)。

2026-10-15 Phase 6 模型收斂啟動：已整理[限期展、美術館、表演、海洋節目與奇美活動候選的時間及身分語意](docs/domain-model.md)。第 025 migration 增加資料庫複合外鍵，表演場次不可掛到海洋節目、每日時段不可掛到表演；隔離 PostgreSQL 測試亦驗證已有場次的父節目不可換領域。本機 migration 已套用；71 項單元、型別與隔離 PostgreSQL／HTTP 整合測試通過。這是資料完整性與模型盤點，**尚無跨領域公開搜尋、沖繩來源或線上部署**。見 [ER-74](docs/technical-decisions.md)。

2026-10-15 Phase 4 清單可靠性續作：第 024 migration 讓海生館每日成功批次保存來源鍵；筆數大幅縮水或同筆數但多數來源鍵更換時，以 `SOURCE_ANOMALY` 拒收，舊清單與快照不變。站長核對官方當日頁後可附 20–500 字說明、官方 HTTPS 佐證與核對者人工放行，成功批次留痕；非官方證據與無異常覆核均拒絕。71 項單元、型別及隔離 PostgreSQL／HTTP 整合測試通過，第 024 migration 已套本機。**只用合成異常驗證，沒有真實特殊日放行紀錄**；既有 10/15 批次無來源鍵，待下一次正常官方同步建立基準。見 [ER-73](docs/technical-decisions.md)與[階段紀錄](docs/stage-2026-10-15-phase4.md)。

2026-10-15 Phase 4 每日紀錄續作：第 023 migration 保存海生館每天成功匯入的完整節目快照，同日變更留版本、相同內容重跑不增版，異常批次不留快照。公開 API 可依 `date` 查當日最後成功版本並列可查日期；React 深海探勘可切換歷史紀錄，對照其與最近成功觀察的節目及時段差異。第 023 migration 已套本機，官方 10/15 節目再同步 9 筆全未變，建立第一份正式快照。70 項單元、型別、React build 與隔離 PostgreSQL／HTTP 整合測試通過。更早日期未回填，跨週來源穩定仍待觀察；未上線排程。見 [ER-72](docs/technical-decisions.md)與[階段紀錄](docs/stage-2026-10-15-phase4.md)。

2026-10-15 Phase 4 深海探勘續作：海生館官方當日表本機同步 9 筆全未變，觀察日更新至 10/15。館方服務頁目前的全年平常 09:00–17:00 與舊導覽分月時間不一致，導覽已改正。第 022 migration 新增**有官方指定日期證據的人工特殊開館核對**與異動紀錄；`/visit-status` 只對已核對日期回開／休館，其他日期仍為 `unknown`。隔離 PostgreSQL／HTTP 測試涵蓋冪等、佐證拒收及未核對日；沒有宣稱全年假期自動判定。見 [ER-71](docs/technical-decisions.md)及[階段紀錄](docs/stage-2026-10-15-phase4.md)。

2026-10-15 Phase 3 本機功能驗收：臺中國家歌劇院 `place=1` 節目已具多場次、廳、票價／購票入口、來源去重、場次異動與安全的狀態處理。官網全節目「已額滿」按鈕可標 `sold_out`；標題或作品簡介的部分場次異動先標 `unknown`、排除未來清單，再以官方詳情或新聞逐場人工核對並保存證據／異動紀錄。同版同步保留結論，來源內容變動則需重審。React 可切換即將演出與完整紀錄。第 020／021 migration 已套本機；隔離 PostgreSQL／HTTP 整合測試、69 項單元、型別與 React build 通過。真實 `place=1` 清單本機同步 20 筆均未變，29 個目前來源場次仍全為 `scheduled`；另外兩個官網詳情唯讀驗證全額滿與部分異動解析。**只驗收此篩選範圍與本機功能，不宣稱即時逐場票務、其他篩選條件或跨週穩定**。見 [ER-70](docs/technical-decisions.md)與[階段紀錄](docs/stage-2026-10-15-phase3.md)。

2026-10-15 P3 歌劇院場次異動公告防誤刊：核對館方節目詳情後確認，部分場次延期／取消可只寫在「作品簡介」的醒目公告，標題與場次列表仍保留原樣。Adapter 現會攔下標題或該區公告內明示異動的節目，整批停止匯入並指出需核對的詳情網址；舊資料保留，不推定各場次狀態。68 項單元測試及型別檢查通過。這是已知公告版位的保守防線，尚未自動辨識個別取消／延期／售罄，詳見 [ER-69](docs/technical-decisions.md)。

2026-10-15 P3 歌劇院缺席節目顯示修正：預設 `/performances` 以最近一次成功、含來源鍵的官方 `place=1` 清單限制節目；來源上整筆缺席時保留資料與 `period=all` 歷史查詢，但不再混入訪客的未來場次。異常失敗批次和人工抽樣不取代成功基準；這不是取消判定。隔離 PostgreSQL 測試涵蓋基準建立、拒收、覆核後縮水和歷史保留，Docker Engine 恢復後已重跑通過；67 項單元、型別與 React build 亦通過。未做真實官網新一輪同步或跨週觀察，見 [ER-68](docs/technical-decisions.md)。

2026-10-15 表演清單時態修正：`/performances` 預設只回傳尚未開始且狀態為 `scheduled`／`sold_out` 的場次，同節目已過場次不混列；`total`、排序與分頁依篩選後結果計算，`period=all` 可查保留的完整紀錄。React 表演區同步說明這不是即時票務，完整邊界見 [ER-67](docs/technical-decisions.md)。67 項單元、型別檢查、React build 及隔離 PostgreSQL 整合測試通過。整筆節目缺席問題由後續 ER-68 處理；線上排程仍未啟用。

2026-10-14 歌劇院清單來源鍵異常保護：第 019 migration 為成功／失敗的官方 `place=1` 批次保存來源鍵。前後清單至少各 10 筆時，若重疊來源鍵少於較小清單的一半，即使總筆數相同也以 `SOURCE_ANOMALY` 整批拒收；人工核對後可用 `--review-list-change` 留原因放行（原 `--review-shrink` 仍可用）。隔離 PostgreSQL 測試涵蓋同筆數大量換鍵、縮水及覆核；67 項單元、型別與 React build 通過。本機第 019 migration 已套用，再次真實同步 20 筆全部未變並保存新鍵基準。這只建立基準，未證明跨週穩定，見 [ER-66](docs/technical-decisions.md)。

2026-10-14 歌劇院官方清單縮水保護：第 018 migration 將 `ntt_place1_list` 與人工抽樣分開，避免混用基準。已有至少 10 筆成功基準時，若新清單少於一半，整批以 `SOURCE_ANOMALY` 拒收；人工核對確屬正常變動可用 `--review-shrink` 留 20–500 字說明放行，`domain_source_runs.review_note` 保存理由。隔離 PostgreSQL 整合測試涵蓋拒收、保留原資料、抽樣不污染基準及覆核放行；66 項單元、型別與 React build 通過。本機 migration 新套用 1 份，真實 `place=1` 清單同步 20 筆（更新 1、未變 19），建立新範圍的首個基準。首次成功不代表跨週穩定或所有節目覆蓋，見 [ER-65](docs/technical-decisions.md)。

2026-10-14 歌劇院清單覆蓋核對：官網「MORE」目前只展開已在同一 HTML 的隱藏卡片，沒有額外分頁請求；來源 adapter 原本已掃過這些卡片，現加入 MORE 行為變更即停止匯入的保護及測試。再次真實手動同步接受官方 `place=1` 清單 20 筆（新增 1、未變 19），單批仍上限 30 筆。這只代表該篩選頁當次的完整 HTML，未證明歌劇院所有類型或跨週穩定；逐場票務狀態仍待查。見 [ER-64](docs/technical-decisions.md)。

2026-10-14 Phase 3／4 可靠性續作：修正整合測試在 HTTP 測試伺服器關閉後才使用查詢函式的作用域錯誤；隔離 PostgreSQL 測試現已通過，包含海生館 `SOURCE_ANOMALY` 舊批次保留／新批次公開清單，以及歌劇院 19 筆**合成測試資料**的批次冪等。歌劇院真實手動同步首次因官方詳情逾時停止；新增僅對逾時／網路與 HTTP 5xx 的兩次有限退避重試、保留失敗網址後再執行成功：官網初始清單接受 19 筆（新增 14、未變 5），本機 `/performances?source=ntt` 回傳 19 筆。64 項單元測試、型別檢查與 React build 通過。**MORE 分頁、跨週來源穩定、逐場票務、特殊開館及公開部署仍未完成**。見[ER-62／63](docs/technical-decisions.md)。

2026-10-14 開發文件整理：新增[開發導覽](docs/development-guide.md)串起資料路徑、狀態判讀、API、來源與驗證入口；OpenAPI 端點分類與歌劇院涵蓋範圍說明已同步，架構和運作文件修正舊敘述。這一輪是文件更新，**沒有新增資料來源、部署或排程能力**。

2026-10-13 Phase 4 資料品質續作：海生館每日節目匯入新增 `SOURCE_ANOMALY` 清單大幅縮水保護；公開 `/marine-programmes` 改為只列最近一次成功匯入的節目，避免不同觀察日混在同一頁。61 項單元測試與型別檢查通過；**新資料庫整合測試已編寫，但本機 PostgreSQL 尚未啟動，尚未實跑**。不代表已取得特殊開館或未來節目保證。見[ER-60](docs/technical-decisions.md#er-60海生館每日節目清單縮水保護與最近觀察批次)。

2026-10-13 Phase 3 清單覆蓋續作：臺中國家歌劇院手動同步已改為讀取官網初始清單的全部可辨識節目，不再靜默停在前五筆；來源若超過單批 30 筆會停止而非截斷。2026-10-13 只讀實測初始清單 19 筆，19 個官方詳情均回 200 且可解析場次；逐頁間隔兩秒。60 項單元測試、型別檢查及 React build 通過。**尚未寫入本機資料庫或完成整合測試**（本機 PostgreSQL 當時未啟動）；「MORE」後續內容、逐場票務狀態與跨日穩定仍未完成。詳見[階段紀錄](docs/stage-2026-10-13-ntt-initial-list.md)與[ER-59](docs/technical-decisions.md#er-59歌劇院初始清單不再靜默只取五筆已實作只讀驗證)。

2026-10-13 Phase 4 次日觀察：海生館[官方當日節目頁](https://www.nmmba.gov.tw/ActiveShow_D_Cus.aspx?n=33D045D1594ED637&sms=00C15C8CDECA96C3)只讀回 200，頁面日期與臺灣當日相符，解析器再次取得 9 筆，每筆場次可辨識；例如大洋池餵食為 10:00、13:00、16:30。這是第二個日曆日的來源格式證據，**未寫入資料庫，也不足以推定未來每日都相同**；特殊開館仍須看館方公告。見[Phase 3／4 階段紀錄](docs/stage-2026-10-12-phase3-4.md)。

2026-10-12 場館圖鑑更新：臺中國家歌劇院已加入第十一張圖鑑卡及獨立介紹頁，依官方場域、開館與交通資料整理，連到現有表演節目區；照片作者、授權及舊節目廣告限制已標註。型別、59 項單元、React build、隔離 PostgreSQL 整合測試與本機頁面核對通過，詳見[階段紀錄](docs/stage-2026-10-12-ntt-guide.md)。這是靜態場館介紹，不是常設展或新增自動來源。沖繩 Phase 5 依使用者指示暫停，未接入來源或圖鑑。

2026-10-12 Phase 3／4 更新：臺中國家歌劇院官方清單首頁最多五筆詳情已接入本機手動同步，節目與場次分表保存，`/performances` 和 React 獨立表演區可查；首次匯入 5 筆。海生館官網當日節目表已接入，保留觀察日期、每日多時段、地點與長度，`/marine-programmes` 與 React 獨立「深海探勘」下潛區可查；2026-10-12 首次匯入 9 筆。第 017 migration 已套用本機資料庫；59 項單元、型別、React build 與隔離 PostgreSQL 整合測試通過。**Phase 3／4 皆為第一版部分完成**：歌劇院 MORE 分頁、逐場售罄／取消／延期證據與跨日穩定未完成；海生館特殊開館只提供官方核對入口，尚無逐日自動判定。仍未公開部署或啟用排程。詳見[ER-55～57](docs/technical-decisions.md)與[階段紀錄](docs/stage-2026-10-12-phase3-4.md)。

功能狀態最後核對：2026-10-12（臺灣時間）。**網站仍是本機 MVP，尚未公開部署或啟用線上每週同步。**[技術處理與決策紀錄](docs/technical-decisions.md)逐項說明做法、取捨及證據；[目前與目標架構](docs/architecture.md)分開標示已實作和構想；[第四階段紀錄](docs/stage-2026-10-05-phase4.md)記錄科博館 API 與休館提醒的實測；[來源狀態階段紀錄](docs/stage-2026-10-10-freshness.md)記錄最新網站提示與驗證；[票務來源與維護](docs/ticketing.md)記錄票價查證範圍。

奇美官網內部 JSON 端點是**候選來源**：無 Cookie／CSRF 的 POST 回 419；公開頁正常匿名流程曾回 200 JSON（三組筆數 1／4／10）。`npm run probe:chimei` 是只讀檢查；奇美專用**離線候選適配器**將限期特展、常設展及活動分流。限期特展未接正式匯入；活動已有人工快照與本機候選活動表，但未接 Queue、每週排程或公開活動 API。跨週穩定、完整性與可持續使用條件尚未證實；詳見[實測與啟用門檻](docs/stage-2026-10-11-chimei-probe.md)、[候選來源評估](docs/chimei-internal-endpoint.md)及[ER-51](docs/technical-decisions.md#er-51奇美活動候選表的冪等匯入與異動歷史已實作本機驗證)。

| 能力 | 實際狀態 |
| --- | --- |
| React 首頁 | 已將本機首頁改為 React + Vite，採考古、古文明與遠古生命視覺；搜尋、城市與館所連動、展覽狀態、票務切換、詳情展開及分頁載入均可互動。資料載入有發掘動畫，支援減少動態效果；圖鑑十一張卡片都有對應照片與對外來源／授權頁，十一頁介紹仍為靜態頁（其中一頁是歌劇院場館）。未公開部署。 |
| 特展搜尋 | 本機網站可依城市、館所、關鍵字、基準日、展覽狀態及明確免費資訊查詢；選城市只列該地區館所。關鍵字按字面比對，`%`、`_` 不作萬用字元；票價缺失不推斷免費。 |
| 票價／購票索引 | 十館一般入館或常設展票價、官方票價頁與有查證的購票入口已統整；奇美《埃及之王：法老》另有展覽專屬票價。各館核對日為 2026-10-10 或 2026-10-11，並非即時票價或售票名額；未查證的特展票價仍顯示待核對。 |
| 館所與場館介紹 | 十頁博物館／美術館典藏、常設展或參觀路線，以及一頁歌劇院場館導覽；各頁列平常開館時間及官方參觀資訊入口。舊九館人工核對日 2026-10-10，國美館為 2026-10-11，歌劇院為 2026-10-12。特殊時間以館方公告為準，不做全館逐日開放推定。 |
| 交通入口 | 十一頁導覽可選起點，開啟地圖的交通路線；本站不計算最佳路線或即時票價。 |
| PostgreSQL／API | 本機已實作展覽、來源原始紀錄、隔離、保守去重、欄位異動、查詢 API。 |
| API 回應契約 | OpenAPI 文件涵蓋既有特展／館所查詢、奇美活動靜態快照，以及 `/performances`、`/marine-programmes`、`/marine-observation-days`；CI 的隔離 PostgreSQL 整合測試會對實際 HTTP 成功與既有錯誤回應逐層驗證 schema，並要求每條文件化 GET 路由有成功回應覆蓋。503／500 故障回應尚未逐條整合驗證；見[階段紀錄](docs/stage-2026-10-11-openapi-response-validation.md)與 ER-55／56／72。 |
| 自動資料來源 | 科博館私人 Key 官方 API 已核發並本機驗證；原公開 JSON 保留備援。故宮南院官方頁、故宮北院公開 JSON、海生館公開 JSON，以及科工館公開 JSON 與官方逐筆頁有本機匯入器。國美館官方當期／預告 HTML 與文化部 NTMOFA 詳情頁已接本機手動同步，首次 12 張卡中 3 筆本館限期展入庫；未接線上排程。海生館其他缺日資料仍待審。 |
| 休館提醒 | 科博館用官方 API 查未來一週逐日開館資訊；十館介紹頁都有人工核對的平常時段。奇美週三可能有特別開放場次，逐日狀態維持「請確認」，不單憑星期判定休館。其他館只引導查官網，不宣稱即時開館狀態。 |
| 奇美特展 | 一筆既有人工核對展示資料。文化部 iCulture 展覽資料是**補充來源**，同展分段合併後須與奇美官方詳情頁交叉核對。本機實測 10 筆相關資料，1 筆連到既有展覽、8 筆隔離。另有只讀監測：比對特展列表初始 HTML 可見連結，以及已知法老展官方詳情的展名與完整展期；2026-10-10 本機實測通過。列表由前端動態載入，這項監測**不代表完整奇美自動同步**。 |
| 奇美活動與節目 | 2026-10-11 人工觸發的官網清單快照收錄 10 筆 `expoEvent`，含西洋武術工作坊、音樂節、VR 與實境遊戲；首頁獨立區塊顯示館方時間文字與逐筆官方連結。本機另以 `programme_events` 候選表保存來源 ID、原始日期、保守分類；重跑冪等，欄位變更寫入 `programme_event_changes`，異常縮水回滾。**活動前端仍讀人工快照**；未做自動排程、公開活動搜尋、當期狀態或來源缺席取消判定，亦不把活動稱為限期特展；詳見 ER-50／51。 |
| 待審補正 | 海生館與故宮北院可使用命令列或獨立、僅綁定 `127.0.0.1` 的密碼保護審核頁；證據內容仍需人眼核對。下次匯入相同來源才套用，來源變更時撤回舊補正。 |
| 各館重試與觀測 | 本機直接 `sync` 對暫時性錯誤最多嘗試三次；`sync_attempts` 留存嘗試、時長與錯誤。`sync:status` 查狀態；`sync:failed` 重跑最近失敗的來源。這條直接同步流程沒有走 Queue，也沒有自動告警。每週 workflow 定義六館獨立 Queue 工作與歌劇院節目工作，但**未在線上執行**。 |
| 來源健康報告 | `sync:status` 依 `sync_id` 彙整最近七天每次工作的最終成敗與重試，結合官方成功時間、待審與新缺席候選；登入本機管理頁 `/health` 可看中文摘要。最近七天是失敗率統計窗口，14 天是官方來源時間過期門檻；沒有紀錄不標成正常，也沒有主動告警。詳見[階段紀錄](docs/stage-2026-10-10-source-health.md)。 |
| PostgreSQL 來源 Queue | 已有本機、手動啟動的六館 `FETCH_SOURCE` 工作表與 worker；同館同日去重、並行領取、三分鐘租約、暫時錯誤退避、最多三次與 `dead` 人工重播已通過隔離資料庫測試。每週 workflow 已接入單館 Queue 工作，但仍由閘門關閉、未在線上執行；解析／通知沒有拆成 Queue。詳見[階段紀錄](docs/stage-2026-10-10-source-queue.md)。 |
| 匯入品質閘門 | 空來源記失敗；有原始紀錄但 0 筆可公開展覽時保留原始／待審資料、記失敗並回傳非零碼，不刷新成功時間。官方批次全數無法核對時暫不隱藏舊展；完整度未顯示疑似縮水時，主來源轉待審的既有展覽會下架，其他有效來源可重新接手。隔離 PostgreSQL 整合測試已驗證。 |
| 官方清單缺席候選 | 成功官方匯入後，若先前公開、尚未結束的展覽未出現在本次來源清單，記錄缺席候選與連續次數；重新出現會結案。可在本機審核頁或 `review -- --missing` 查官方原頁。這只供人工核對，不代表展覽已取消，也不自動下架；手動快照與失敗批次不會觸發。 |
| 官方清單完整度保護 | 官方首次匯入建立來源鍵數、可公開展覽數及來源鍵清單基準；後續若筆數疑似大幅縮水，或筆數未減但來源鍵幾乎全換，該次暫緩缺席候選新增／結案及因這批待審資料隱藏舊展，保留基準並標 `deferred_partial`。既有筆數基準下一次正常同步才補鍵清單。本機 `/health`、`sync:status` 與公開 `/museums` 可看判定，網站向訪客提示。有效展覽仍可匯入；啟發式門檻不能證明清單完整。詳見[筆數](docs/stage-2026-10-10-source-coverage.md)與[來源鍵](docs/stage-2026-10-11-source-identity-coverage.md)階段紀錄。 |
| 官方清單基準人工審查 | `coverage:baseline inspect` 比較最新異常批次與可信基準；站長核對官方頁後可用 `accept` 記錄證據與理由、更新下次比較基準。拒絕非最新批次及無關網域，核准不改舊展可見性；仍須再跑一次成功官方同步才能重評完整度。僅有本機測試，未有真實換季核准或線上運作證據。詳見[階段紀錄](docs/stage-2026-10-11-source-baseline-review.md)。 |
| 缺席人工核對 | 本機密碼保護管理頁可對缺席候選記錄審查人、同來源網域證據、說明及「保留／需追查」結論；下一次官方同步仍缺席會重新待審，歷史保留。兩種結論都不自動下架，也沒有主動通知；詳見[階段紀錄](docs/stage-2026-10-10-missing-review.md)。 |
| 資料新鮮度與待審提示 | `GET /museums` 分開回傳最後成功匯入與最後成功取得官方來源時間；狀態依後者及最近同步嘗試判斷。手動匯入舊快照不會刷新官方時間。特展頁提示最近失敗、超過 14 天未成功取得官方來源、人工核對或本機快照，並提供館方入口。另回傳 `pendingReviewCount` 提醒有多少來源紀錄仍待審，可能含歷史資料，不等於漏掉的當期展覽。14 天是每週排程的一次漏跑緩衝門檻；屬被動提示，不代表線上每週同步已啟用。 |

第三階段驗證：`npm test` 20/20、`npm run typecheck`、`npm run test:integration` 通過；官方科工館與文化部奇美資料實際匯入本機。第四階段另以科博館金鑰實測展覽 7 筆與逐日開館資訊；詳見[第四階段紀錄](docs/stage-2026-10-05-phase4.md)。第五階段加入狀態／免費篩選及公開 API 回應契約測試；索引分析見[第五階段紀錄](docs/stage-2026-10-05-phase5.md)。本機資料庫網站仍需啟動服務查看；不是公開站。

React 本機首頁改版已完成；[本階段紀錄](docs/stage-2026-10-10-react.md)列出視覺、功能與驗證。每週同步及公開部署沒有線上運作證據。已有本機 PostgreSQL 來源 Queue 與未啟用的每週排程路徑，但多階段 Queue、訂閱通知、AWS 仍未實作。臺博館、臺史博與科教館已有靜態導覽，但沒有特展匯入器。[來源盤點](docs/sources.md)與[來源查證](docs/api-source-research.md)列出依據。

下一步依[11 階段修正版優先順序](docs/future-roadmap.md#2026-10-11-優先順序取代下方舊版擴館部署順序)先保留奇美與五館資料來源的未結可靠性項目；Phase 2 國美館已有本機來源，Phase 3 表演藝術與 Phase 4 深海探勘已有第一版本機資料與介面，接著補完整覆蓋、跨日穩定與國外來源。模型、測試、文件完成後才處理部署。PostgreSQL Queue 的排程程式路徑已接好但未線上運作；是否需要 Redis/BullMQ，應依資料量與故障情境決定。

奇美已知展覽監測的範圍、輸出及驗證見[本階段紀錄](docs/stage-2026-10-10-chimei-monitor.md)。這個檢查不會寫入資料庫，也沒有替代完整資料來源。

同步品質閘門的實作、測試與限制見[階段紀錄](docs/stage-2026-10-10-sync-quality.md)及[技術決策 ER-13](docs/technical-decisions.md)。

2026-10-10 的審查修正補上「既有有效來源轉待審」隔離、字面關鍵字搜尋與官方同步時間分離；本機單元測試 30/30、型別檢查及 PostgreSQL 整合測試通過。尚未公開部署。

下一階段的官方清單缺席候選已在本機完成；[階段紀錄](docs/stage-2026-10-10-missing-candidates.md)列出判定條件、操作及測試。線上排程仍未啟用。

再下一階段的缺席人工核對已完成本機測試；[階段紀錄](docs/stage-2026-10-10-missing-review.md)及[技術決策 ER-31](docs/technical-decisions.md)記錄交易、證據限制與目前界線。

來源健康報告已在本機完成；[階段紀錄](docs/stage-2026-10-10-source-health.md)及[技術決策 ER-32](docs/technical-decisions.md)記錄以工作而非嘗試計算失敗率的理由與測試。

本機來源 Queue 已完成第一版；[階段紀錄](docs/stage-2026-10-10-source-queue.md)及[技術決策 ER-33](docs/technical-decisions.md)記錄入列、租約、重試、死信與仍未接線上排程的界線。

官方清單完整度保護已完成本機測試；[階段紀錄](docs/stage-2026-10-10-source-coverage.md)及[技術決策 ER-34](docs/technical-decisions.md)記錄疑似部分回應時暫緩缺席判定的規則及限制。

同日審查後補正：官方清單完整度會在待審資料改變展覽可見性之前判定；`deferred_partial` 時舊展不會因這批不完整清單被隱藏。公開 `/museums` 的 `coverageStatus` 讓訪客看見疑似不完整警示，同時保留原有新鮮度狀態。奇美介紹頁返回特展搜尋的錨點也已修正。本機 34 個單元測試、型別檢查、隔離 PostgreSQL 整合測試與桌面瀏覽器操作已驗證；尚未公開部署或驗證長期排程。

2026-10-11 講義審查修正：空白資料庫可用 `npm run migrate` 建立 001–012 與版本帳本；既有本機資料庫已備份、核對結構並明確登記 12 份基線，再跑一般 migration 顯示新套用 0 份。兩個 HTTP 服務會先確認資料庫連線，公開健康檢查故障回 503。公開 API 已有 OpenAPI 文件。型別檢查、37 個單元測試及隔離 PostgreSQL 整合測試通過；詳見[階段紀錄](docs/stage-2026-10-11-lecture-fixes.md)。這不代表網站已公開部署。

2026-10-11 排程 Queue 階段：五館週排程 workflow 改用單館 jobs:scheduled，依 job ID 隔離、等待退避重試並回報成功或死信；隔離 PostgreSQL 整合測試通過。排程閘門仍關閉，尚無線上運作證據。詳見[階段紀錄](docs/stage-2026-10-11-scheduled-source-queue.md)及[技術決策 ER-39](docs/technical-decisions.md#er-39每日排程接入單館來源-queue已實作本機驗證)。

2026-10-11 頻率調整：五館同步設定為每週二臺灣時間 04:15 的候選排程，官方來源時間過期提醒改為 14 天；每週排程仍未在線上啟用。型別檢查、37 項單元測試、隔離 PostgreSQL 整合測試與 workflow 靜態核對通過。決策與限制見[ER-41](docs/technical-decisions.md#er-41來源同步改為每週候選頻率已修改程式路徑未線上啟用)。

2026-10-11 奇美候選適配器階段：離線分類三種頂層資料，限期特展只接受有效單一展期及官方連結；只讀 probe 當日第二次回 1／4／10，結構可解析候選 1、待審 0。42 項單元測試、型別檢查及隔離 PostgreSQL 整合測試通過。候選資料未寫入 DB，正式同步仍待跨週穩定性、官網清單完整度、詳情與既有人工資料關聯及使用條件核對；見[ER-42](docs/technical-decisions.md#er-42奇美內部-json-的離線候選適配器已實作尚未接入匯入)。

2026-10-11 來源可靠性階段：科教館特展列表可匿名讀取，但部分項目缺完整起訖日或只連外部售票頁，暫不列入第六個自動來源。現有五館匯入的完整度閘門增加來源鍵交集比較：即使總筆數不變，大幅換項目也暫緩舊展缺席判定與下架。migration 013 已套用至本機既有資料庫；43 項單元測試、型別檢查與隔離 PostgreSQL 整合測試通過。尚未觀察正式跨週同步；見[ER-43](docs/technical-decisions.md#er-43官方來源同筆數大幅換項目時暫緩缺席判定已實作本機驗證)及[階段紀錄](docs/stage-2026-10-11-source-identity-coverage.md)。

2026-10-11 人工基準審查階段：官方清單若因真正換季而持續顯示 `deferred_partial`，站長可預覽新舊來源鍵、核對官方頁，再以批次 UUID 與審查理由更新可信比較基準。審查留下資料庫紀錄，拒絕舊批次與無關網域；核准本身不改展覽可見性，下次官方成功同步才重新評估。型別檢查、43 項單元測試及隔離 PostgreSQL 整合測試已通過；本機正式資料庫 migration 狀態見[階段紀錄](docs/stage-2026-10-11-source-baseline-review.md)。尚未有實際館方換季人工核准案例或線上同步證據。

2026-10-11 API 契約階段：CI 既有整合測試現以 `docs/openapi.yaml` 實際驗證六條公開 GET 路由的 HTTP 成功回應及已測的 400／404 回應，含巢狀票務和 nullable；新增公開路由若缺成功回應覆蓋也會失敗。44 項單元測試、型別檢查與隔離 PostgreSQL 整合測試通過。503／500 尚未逐條注入故障驗證，亦未新增線上部署；見[ER-45](docs/technical-decisions.md#er-45ci-用-openapi-驗證實際公開-api-回應已實作本機驗證)與[階段紀錄](docs/stage-2026-10-11-openapi-response-validation.md)。

2026-10-11 五館真實來源演練：各館單次同步均成功、沒有重試；取得來源列依序為科博館 8、故宮南院 7、故宮北院 22、海生館 30、科工館 8。北院 15、海生館 26、科工館 1 筆待審，不能把成功同步寫成完整清單。公開 `/museums` 與 React 新增待審筆數提示，OpenAPI 和隔離 PostgreSQL 整合測試同步更新；44 項單元測試、型別檢查與整合測試通過。這是本機單日觀察，非跨週穩定性或線上運作證據；見[ER-46](docs/technical-decisions.md#er-46五館真實同步演練與公開待審提示已實作本機驗證)及[階段紀錄](docs/stage-2026-10-11-five-source-drill.md)。

2026-10-11 海生館逐筆頁展期補正：只有來源 JSON 的介紹文字含單一、完整、有效且明標「展出日期」的範圍，才讀同筆官方詳情頁比對頁面標題與日期；請求失敗、日期衝突或缺結束日仍待審。本機再次同步 30 筆，公開紀錄由 4 增至 5、待審由 26 降至 25；新增的《SEA YOU》展期為 2026-04-02 至 2026-06-28，網站歸為「已結束」，不在當期搜尋。48 項單元測試、型別檢查與隔離 PostgreSQL 整合測試通過；見[ER-47](docs/technical-decisions.md#er-47海生館官方詳情頁二次核對缺漏展期已實作本機驗證)及[階段紀錄](docs/stage-2026-10-11-nmmba-detail-dates.md)。線上同步仍未啟用。

2026-10-11 圖鑑補圖：首頁九張館所卡片現在各有對應照片。故宮南北院、科工館、海生館沿用已核對的本機素材；臺博館、臺史博、科教館新增授權可查的 Wikimedia Commons 館舍縮圖。圖鑑區提供[對外照片署名頁](web/photo-credits.html)；展場與建築照片不代表當期展件或展期。修改與檢查見[ER-48](docs/technical-decisions.md#er-48館所圖鑑九館影像與對外署名已實作本機驗證)及[階段紀錄](docs/stage-2026-10-11-guide-images.md)。

2026-10-11 Phase 2：國美館成為第十張圖鑑卡與介紹頁，館方開放時間、交通及一般入館免費資訊已人工核對，照片來源與舊展布條已署名說明。國美館官方當期／預告頁的本機手動同步首次匯入 3 筆本館限期展；資料完整性及跨週穩定仍待觀察。見[Phase 2 紀錄](docs/stage-2026-10-11-phase2-ntmofa.md)及[ER-52／53](docs/technical-decisions.md)。

2026-10-11 館方活動預告來源初查：海生館官方最新公告 RSS 可匿名取得候選資料，科博館官方最新消息可讀科教活動及逐筆頁；奇美最新消息初始 HTML 仍缺完整動態清單。預告應與特展分流，發布日或公告保留期限不能代替實際活動日期。目前**只有可行性查證，尚無公告匯入、API 或前端功能**；見[ER-49](docs/technical-decisions.md#er-49館方活動預告與特展資料分流規劃來源已初查)及[來源查證](docs/stage-2026-10-11-announcement-feasibility.md)。

2026-10-11 奇美活動補漏：官網的西洋武術工作坊實際屬「活動與節目」而非限期特展；正常公開頁匿名流程取得的 `expoEvent` 有 10 筆。已建獨立本機快照、首頁活動卡片與奇美介紹頁入口，本機瀏覽器核對 10 筆均顯示，工作坊連到館方逐筆頁；390px 手機寬度亦檢查。快照需人工執行 `npm run refresh:chimei:activities` 才更新；沒有持續自動同步或當期活動日期判定。型別檢查、React build、50 項單元測試及隔離 PostgreSQL 整合測試通過；見[ER-50](docs/technical-decisions.md#er-50奇美活動與節目的人工更新快照已實作本機驗證)。

2026-10-11 Phase 1 續作：新增 015 migration 與奇美活動候選匯入。工作坊售票日不推定成活動場次；VR 明確完整範圍才產生起迄日。隔離資料庫測試驗證來源 ID 冪等、欄位歷史、舊快照及大幅縮水回滾；本機資料庫已套用 migration，10 筆初匯入，重跑 10 筆未變。型別、52 項單元與整合測試通過。五館 `sync:status` 最新工作均成功，但北故宮 15、海生館 25、科工館 1 筆來源待審，尚不能標成「五館 review 已清零」；首次 coverage 基準仍需跨週比較。特展候選正式匯入、奇美完整覆蓋與公開活動 API 仍未完成；[階段紀錄](docs/stage-2026-10-11-phase1-programmes.md)列出待審原因及下一門檻，[ER-51](docs/technical-decisions.md#er-51奇美活動候選表的冪等匯入與異動歷史已實作本機驗證)記錄取捨。

2026-10-11 Phase 2 開始：國立臺灣美術館官方當期與預告 HTML 清單接入本機手動同步，逐筆官方詳情確認本館限期展；12 張卡中 3 筆匯入，9 筆館外／線上／常設／公告排除，0 筆待審。第 016 migration 增加 `art_museum` 與獨立美術展欄位、相關活動及異動歷史；教育展已有 3 位官網明列參展藝術家與 B1 展區，策展人未明確對應而保持空陣列。React 新版預覽在 `http://127.0.0.1:3006/?museum=ntmofa#explore-title`，舊 3000 埠程序可能仍回舊 API 欄位。型別、React build、55 項單元與隔離 PostgreSQL 整合測試通過；單日首次成功仍未證明來源完整、跨週穩定或排程可用。詳見[階段紀錄](docs/stage-2026-10-11-phase2-ntmofa.md)與[ER-52](docs/technical-decisions.md#er-52國美館來源只收本館限期展藝術欄位獨立建模已實作本機單日驗證)。

2026-10-11 Phase 2 審查修正：國美館等只有 2–3 筆公開展的小清單，若縮至一半以下也暫緩舊展缺席判定；`GET /exhibitions/:id/art-changes` 現可查藝術欄位變更，OpenAPI 契約與真實 HTTP 整合測試同步驗證。官網當期頁目前列 11 張卡、預告頁 1 張，未見下一頁文字；這只核對當日可見頁，未證明未來沒有分頁或跨週清單穩定。搜尋索引仍按 ER-21 的約 28 筆本機量測維持現狀，尚未做新版資料量的重測。56 項單元、型別、React build 和隔離 PostgreSQL 整合測試通過；見[ER-34、ER-54](docs/technical-decisions.md)與[階段紀錄](docs/stage-2026-10-11-phase2-review-fixes.md)。
