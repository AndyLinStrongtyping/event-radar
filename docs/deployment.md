# Phase 9：公開測試版部署手冊

目前只完成**可在本機驗證的部署準備**；沒有建立雲端服務、公開網址或線上資料庫。本手冊的第一站採 Render 單一 Web Service（同源提供 React 與 API）和 Neon PostgreSQL。`render.yaml` 是**免費技術預覽**的設定範本；匯入 Blueprint 會實際建立公開服務，需由站長操作。正式面向搜尋流量時再評估常駐方案及費用，無須先導入 AWS。

## 交付邊界

- Web Service 啟動命令是 `npm run start:prod`；build 命令先安裝依賴並執行 `npm run build:web`。`.node-version` 鎖定本輪驗證的 Node 24.14.1。
- `HOST=0.0.0.0` 讓 Render 可連到服務；`PORT` 由平台注入。本機預設仍綁 `127.0.0.1`。
- 只部署公開頁面與讀取 API；`src/admin-server.ts` 是本機審核工具，不在 Blueprint 中，不能將管理頁對外開放。第一版不啟用線上來源 Queue、定時匯入或主動告警。
- `PUBLIC_BASE_URL` 留空時，本站頁面回傳 `X-Robots-Tag: noindex`，`/robots.txt` 允許爬取，以便搜尋引擎讀取 `noindex`，並且不提供 sitemap。這不是密碼保護：知道網址的人仍可看預覽站。決定讓搜尋引擎收錄時，才填入最終 HTTPS 根網址；屆時首頁與館所介紹頁會輸出 canonical，`/sitemap.xml` 會列出這些固定頁面。動態展覽**尚無獨立 HTML 頁面**，因此不在 sitemap，不可宣稱每筆展覽可被收錄。
- 本站不替館方承諾即時票價、當日開館或展件狀態；正式上線前仍須逐頁檢查來源標示、照片授權、隱私與資料新鮮度文字。

## 上線前本機檢查

在專案根目錄執行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run test:integration
npm run check:docs
npm run build:web
```

`test:integration` 需要本機 PostgreSQL／Docker。它使用隔離測試資料庫，不應指向正式 Neon。完整移轉與匯入要另外在正式資料庫執行。

## 需要站長登入後執行的步驟

1. 在 Neon 建立**獨立** PostgreSQL 專案，選離 Render `singapore` 較近的可用區域。將 Neon 的**直接連線** `DATABASE_URL`（含 `sslmode=require`）保存在平台 Secret 或本機未追蹤的環境設定；不要貼進對話、Git、issue 或截圖。保留資料庫備份與權限設定。
2. 以該直接連線網址在本機執行一次 `npm run migrate`。執行前確認目標是新建的遠端資料庫；migration 會建立與修改 schema，不要對既有正式資料庫盲目重跑初始化。記錄套用版本與成功結果，避免記錄連線字串。
3. 使用現有來源同步命令，在遠端資料庫至少匯入一筆經來源驗證、可公開的限期展；逐館核對待審、來源健康和實際內容。**新資料庫只有館所基礎資料，沒有特展資料**，未完成此步時冒煙檢查會故意失敗。第一版允許手動重跑匯入；不要開啟每週 workflow 閘門。
4. 在 Render 連結此 GitHub repo 並匯入 `render.yaml`。檢查方案仍是 `free`、region 為 `singapore`、自動部署為關閉，並將 Neon 連線字串填進 `DATABASE_URL` Secret。Blueprint 建立服務時會提供公開的 `onrender.com` 網址；目前 `PUBLIC_BASE_URL` 留空以免未驗收就被索引。不要把 `NMNS_API_KEY` 放進 Git；只有要在線上手動同步科博館時，才在 Render Secret 設定。
5. 確認 `/health` 回 `status=ok`、`database=ok`；前端、館所介紹、照片與 API 正常。使用以下唯讀命令跑**不開放索引**的技術預覽冒煙檢查：

   ```powershell
   npm run smoke:deploy -- https://你的服務.onrender.com --expect-noindex
   ```

6. 要正式公開給搜尋引擎時，先決定唯一對外網址及常駐方案，在 Render Secret／Environment 設 `PUBLIC_BASE_URL=https://你的正式網域`，重新部署。確認 `/robots.txt`、`/sitemap.xml`、canonical 與 Search Console 網站擁有權驗證，再執行 `npm run smoke:deploy -- https://你的正式網域`。不要把 Search Console 驗證憑證提交到 repo。

每次發版先確認 Git commit SHA、CI 結果與 migration 版本；部署後記錄 Render 實際部署的 SHA 和 smoke 結果。網站的來源版本目前以 Render 部署紀錄核對，**尚無公開 SHA API**。

## 故障與回復

- `/health` 無法啟動：看 Render log、Node 版本、`DATABASE_URL` 是否已設及 Neon 連線權限。不要將完整連線字串貼到 log 或工單。
- `/health` 正常但特展空白：查遠端資料庫是否完成匯入、待審數與來源最後成功時間；不要用本機資料誤認雲端已更新。
- 圖片 404 或 JS/CSS 404：確認 build 成功，且照片與 `web/react-build` 靜態路由對應。網站的 React build 只在 build 階段產生，不在服務啟動時重建。
- 新版故障：停止繼續同步、回看部署 SHA 與 DB migration。Render 可回退程式版本，但資料庫 migration 沒有自動降版；涉及 schema 時先做資料庫備份與相容性判斷，再決定修復或回復。
- 資料來源失敗：保留既有公開資料與隔離紀錄，按 `docs/operations.md` 的人工核對流程處理；不要因一次來源縮水刪除舊資料。

## 已知限制與開放條件

Render 免費 Web Service 會在閒置後休眠；休眠時平台會對 `/robots.txt` 回覆 `Disallow: /`，且不喚醒服務，爬蟲可能看不到本站的 `noindex` 標頭。預覽網址避免對外散播；若需要真正限制存取，應使用登入保護。因此免費方案適合技術預覽，**不適合把搜尋收錄、穩定流量或可用性當成已達成的成果**。Render 免費服務也不能使用 dashboard shell／一次性 job，所以 migration 和首批匯入先由本機連線執行。Neon 方案用量、費率與區域以建立當日官方頁面為準。

資料來源跨週穩定、奇美候選自動匯入、沖繩靜態導覽的自動化、每筆展覽獨立頁、正式站觀測、Search Console 收錄、真實使用者與付費／營利權利評估仍待後續階段；本手冊不能取代這些驗證。

平台依據：[Render Blueprint 格式](https://render.com/docs/blueprint-spec)、[Render 免費方案限制](https://render.com/docs/free)、[Render Node 版本](https://render.com/docs/node-version)、[Neon 連線說明](https://neon.com/docs/get-started-with-neon/workflow-primer)。
