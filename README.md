# Event Radar｜臺灣博物館特展情報

科博館個人 API Key 已在本機驗證並接入當期展覽與未來一週開放時間；搜尋頁也有休館提醒、展覽狀態與明確免費資訊篩選。詳細狀態見[統一進度](STATUS.md)與[第五階段紀錄](docs/stage-2026-10-05-phase5.md)。

目前做到哪裡、哪些尚未接入：請先看 [統一進度](STATUS.md)。每項能力的實作、取捨、證據與限制集中在[技術處理與決策紀錄](docs/technical-decisions.md)；後續功能進度要同步更新該文件。

目前依[11 階段修正版路線圖](docs/future-roadmap.md#2026-10-11-優先順序取代下方舊版擴館部署順序)先做資料來源與 Domain 模型，之後才公開部署。奇美活動已有人工快照及本機候選表的冪等／欄位異動驗證；網站仍讀快照，奇美官網內部端點**不是公開文件化 API**，尚無自動活動同步或公開活動搜尋。

首頁已改為 React 互動介面，採古文明、化石與考古檔案視覺；載入展覽時顯示短暫的文物發掘動畫，並遵守「減少動態效果」系統設定。此為本機改版，尚未公開部署。[本階段實作紀錄](docs/stage-2026-10-10-react.md)記載驗證結果。

![Event Radar React 考古主視覺](docs/screenshots/event-radar-react-hero.jpg)

[早期首頁畫面](docs/screenshots/event-radar-showcase.png)保留作設計歷程。

[架構圖：目前實作與目標方向](docs/architecture.md)將已完成的本機資料流程與使用者提供的長期構想分開標示；目前只有本機 PostgreSQL 來源 Queue 與未啟用的每週排程路徑，概念圖中的多階段 Queue、通知與遠端監控仍未實作。

目標是從臺灣各博物館的官方資訊取得特展資料，整理展期、展館、城市與簡介，供人依地點與日期查詢，並回到官方公告核對。第一版聚焦**特展與期間限定展**，不收市集、音樂會或一般演出。

目前是 **本機 MVP**：資料庫、查詢 API、五館公開資料或官方頁匯入、文化部奇美補充來源、九館博物館介紹、來源隔離、本機審核頁、有限重試及嘗試紀錄、來源 Queue 與未啟用的每週排程路徑、同館去重、欄位異動紀錄與測試已完成本機驗證。搜尋可按展覽狀態與明確免費資訊篩選；現有來源多數沒有可靠的**個別展覽票價**，所以免費結果可能為空。首頁另有九館一般入館票價與購票入口的人工核對索引，奇美法老展有單獨的特展票價；兩種票務資訊分開顯示。[票務來源與維護](docs/ticketing.md)列出人工核對證據，[最新階段紀錄](docs/stage-2026-10-05-phase5.md)列出先前實測與索引判斷。每週同步排程與 CI 已寫成 GitHub Actions 設定檔，但線上每週同步與公開網站尚未啟用，因此不列為已上線系統。

## 範圍

- **首批來源目標**：奇美博物館、國立自然科學博物館、國立臺灣博物館、國立故宮博物院（北／南院）、國立臺灣歷史博物館。
- **第二批**：國立科學工藝博物館、國立臺灣科學教育館、國立臺灣美術館、臺南市美術館。
- 奇美已列入資料來源表。官網有特展頁；目前未查到館方公開活動 API 文件。文化部 iCulture 展覽 JSON 可作不完整的補充來源，分段展期須與奇美官方逐筆頁交叉核對；既有人工整理資料保留。
- 科博館的[官方 OpenAPI](https://www.nmns.edu.tw/ch/about/info-central/opendata/index.html)個人金鑰已核發並在本機驗證。`NMNS_API_KEY` 優先供展覽與未來一週開放時間使用；無金鑰時展覽匯入仍可使用原 `NMNS_OPEN_DATA_URL`，開放時間只顯示官網核對入口。金鑰只存在 Git 忽略的本機 `.env`，不提交到 Git。
- 故宮南院的[當期展覽](https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3112)與[展覽預告](https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3111)是第三個真實來源。匯入有起訖日期的特別展覽與限期輪替展，保留官方詳情連結；無結束日的常設展與年度期程不列入搜尋。這是官方網頁同步，不是館方提供的公開 API。
- 故宮北院[公開展覽 JSON](https://odapi.npm.gov.tw/data/open/api/v1/exhibition/current.json)與海生館[公開特展 JSON](https://www.nmmba.gov.tw/OpenData.aspx?SN=BF6D6EB9CB6876BB)已接入本機。逐筆保留原始值，分流有效、待審與略過資料；故宮按院區與展期保守篩選。海生館若日期欄空白，僅對介紹文字明載完整展期的少數紀錄，再與同筆館方詳情頁的展名及日期核對；其他紀錄仍待審，不推測為常設展。用 `npm run review -- --source nmmba` 或 `--source npm-north` 查看待審原因。
- 首頁的「博物館介紹」另有[奇美](web/guides/chimei.html)、[科博館（含植物園）](web/guides/nmns.html)、[臺博館](web/guides/ntm.html)、[臺史博](web/guides/nmth.html)、[故宮南院](web/guides/npm-south.html)、[科工館](web/guides/nstm.html)、[科教館](web/guides/ntsec.html)、[故宮北院](web/guides/npm-north.html)與[海生館](web/guides/nmmba.html)九頁人工編寫介紹。各頁附常設展路線、2026-10-10 人工核對的平常開館時間與官方查證連結；[開館時間來源](docs/opening-hours.md)列出範圍。多頁附照片及[圖片依據](docs/sources.md#常設展照片來源與使用)。這些時間不是逐日同步資料；國定假日、節慶及臨時變動須以館方公告為準。臺博館、臺史博與科教館的近期特展尚未接入本站資料庫。React 首頁與既有九頁靜態介紹並存。
- 九頁導覽都有交通規劃：可選出發縣市並選填更精確的地址或車站，分別開啟 Google Maps 大眾運輸與開車路線，旁邊保留館方交通連結。只選縣市時以該縣市政府作示意起點；本站不計算即時車程、票價或「最佳」交通方式，也不儲存輸入地點。
- 奇美公開特展頁已有**本機可執行的每週變更檢查**（`npm run check:chimei`）。該檢查與文化部補充匯入互相獨立；前者比對官網初始 HTML 明確列出的連結及已知特展詳情的展名／展期，後者只納入能通過官網逐筆核對的文化部資料，兩者都不保證完整奇美展覽清單。線上排程尚未啟用。

詳見 [需求規格](docs/requirements.md)、[API 契約](docs/api.md)、[來源盤點](docs/sources.md)、[官方 API／第三方資料源查證](docs/api-source-research.md)、[每週同步運作設計](docs/operations.md)與[後續方向（館所與 Queue）](docs/future-roadmap.md)。

**奇美來源新線索（2026-10-11）**：官網展覽頁使用未公開文件化的內部 JSON 端點；無 session 請求回 419；公開頁正常匿名流程可由 Node.js 取得 200。`npm run probe:chimei` 可只讀重測；離線適配器分類限期特展、常設展與活動，活動可手動更新快照並匯入本機候選表，**特展候選未接正式匯入**。沒有跨週穩定、自動同步或公開 API 證據。[實測與啟用門檻](docs/stage-2026-10-11-chimei-probe.md)及[候選來源評估](docs/chimei-internal-endpoint.md)記錄細節。

## 結構

```text
db/                    PostgreSQL 初始化與後續 migration
docs/                 需求、API、來源盤點
src/normalize.ts      特展資料驗證、正規化與 hash
src/ingest.ts         JSON／官方來源匯入與整批回滾
src/server.ts         查詢 API 與網站服務
frontend/             React + Vite 互動首頁原始碼
web/                  靜態館所介紹、圖片與建置輸出（react-build/ 不提交）
test/                 測試與官方資訊範例
```

## 本機執行

需要 Node.js 22.10+、PostgreSQL 17 或 Docker。本機已用 Node.js 24 與 Docker Desktop 的 PostgreSQL 17 驗證資料匯入和 API。此電腦的 Docker 執行檔位於使用者目錄，若終端機找不到 `docker`，可呼叫 `C:\Users\user\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`。

若要先看介面，先執行 `npm ci`，再執行 `npm run preview`，開啟 `http://127.0.0.1:4180/`。`preview` 與 `start` 都會先建置 React 首頁。這個預覽不需資料庫，頁面會標示資料是官方頁快照，並可主動顯示模擬資料；**它不是即時同步**。主視覺採「考古探索未知文明」方向，使用使用者提供的展品照片與原有已標註來源的素材。

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d db
$env:DATABASE_URL='postgres://event_radar:event_radar@localhost:5432/event_radar'
npm run migrate
npm run import:chimei:programmes # 可選：把已人工刷新之奇美活動快照匯入本機候選表
npm test
npm run test:integration
npm run ingest -- --file test/fixtures/chimei.json --source chimei
npm run ingest -- --file test/fixtures/nmns-mock.json --source nmns
# 私人金鑰可設在 Git 忽略的 .env：NMNS_API_KEY=<金鑰>
# 若沒有金鑰，展覽匯入可用政府資料開放平臺的 JSON 資源 URL：
# $env:NMNS_OPEN_DATA_URL='<官方 JSON 資源網址>'
npm run ingest -- --source nmns --official
npm run ingest -- --source npm-south --official
npm run ingest -- --source npm-north --official
npm run ingest -- --source nmmba --official
npm run ingest -- --source nstm --official
npm run ingest -- --source chimei --provider culture --official
npm run review -- --source nmmba
# 查看成功官方匯入後未再出現在來源清單的展覽（僅供人工核對）
npm run review -- --missing
# 缺席候選可在本機管理頁 /missing 核對並留下證據；不自動下架
npm run sync:status
# 登入本機管理頁後，也可開 /health 查看各館健康摘要
# 可選的本機 PostgreSQL 工作佇列（不啟用線上排程）
npm run jobs:enqueue -- --source all
npm run jobs:work
npm run jobs:status
# 單館排程程式路徑（不會開啟線上同步）
# npm run jobs:scheduled -- --source nstm
# dead 工作核對原因後，才用 npm run jobs:replay -- --id <UUID>
# 僅限本機管理頁，需另外設定至少 16 字元的 EVENT_RADAR_ADMIN_PASSWORD
npm run admin
npm start
```

**全新空白 PostgreSQL 資料庫**只需執行 `npm run migrate`，會依序套用 `db/001_init.sql` 至最新 SQL，並在 `schema_migrations` 記錄版本與檔案雜湊；重跑只執行尚未套用的版本。`001` 內的館所列是系統必需的參考資料，不會灌入模擬展覽。**原先已手動套用 001–012 的舊資料庫**，先備份並確認結構後執行一次 `npm run migrate -- --baseline-existing`，再用一般 `npm run migrate`；基線指令會檢查必要表、欄位與索引，不會重建或清空現有展覽。若結構不完整會停止，不可假裝已套用全部版本。試查詢：`http://127.0.0.1:3000/exhibitions?city=嘉義縣`。API 有[人類可讀契約](docs/api.md)、[OpenAPI 規格](docs/openapi.yaml)及 `postman/EventRadar.postman_collection.json`。奇美範例資料根據 [館方展覽頁](https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a68fa1d1a3b)記錄；展期與票價以館方最新公告為準。

## 已完成與未完成

已完成本機驗證：規格、schema 與 migration、科博館私人 Key 展覽／開放時間 API、其他四館公開資料或官方頁 adapter、文化部奇美補充 adapter、查詢 API、休館提醒介面、原始資料隔離、密碼保護的本機審核頁、有限次來源重試與嘗試紀錄、同館跨來源保守去重、欄位異動歷史、PostgreSQL 來源工作佇列及未啟用的每週排程路徑、單元與資料庫整合測試。未完成：奇美新聞自動同步、其他館逐日休館資料、多階段 Queue／通知 worker、線上每週同步、跨館同展關聯、通知、公開部署與 AWS。
