# Event Radar｜博物館與展演資訊整理平台

Event Radar 將多個官方來源的展覽與節目資料轉成可追溯的查詢結果。核心工作是**來源 Adapter、資料驗證、保守去重、異動偵測、待審隔離與來源健康追蹤**；不同領域保留各自的時間模型。[免費公開測試站](https://event-radar-preview.onrender.com/)已於 2026-10-17 上線。Search Console 已讀取網站地圖但尚未收錄首頁；GA4 即時報表已收到本站測試造訪，尚無可宣稱的外部訪客或搜尋成效。免費服務的長期可用性仍待觀察。

| 領域 | 現有能力 | 資料邊界 |
| --- | --- | --- |
| 博物館限期展 | 科博館、故宮南／北院、海生館、科工館等來源的本機匯入、搜尋與異動；國美館另有美術專屬欄位 | 完整展期與官方連結才進公開搜尋；奇美特展仍以人工資料及文化部補充為主 |
| 表演藝術 | 臺中國家歌劇院 `place=1` 範圍的節目、逐場時間／廳別、可核對票價與狀態 | 本機手動同步；不是全站或即時票務 |
| 海洋節目 | 屏東海生館的當日餵食／解說時段與成功批次歷史快照 | 觀察到的當日表不能保證未來每日場次或開館 |
| 靜態導覽 | 沖繩美麗海、澎湖化石館、左鎮化石園區等館所／圖鑑資訊 | 人工整理、有來源連結；不冒充自動匯入 |
| 奇美活動 | 官網內部 JSON 候選 Adapter、人工刷新快照及本機候選表 | 官網端點**不是公開文件化 API**；尚無自動活動同步或公開活動搜尋 |

首頁採 React + Vite，提供城市與館所連動、展覽狀態／明確免費資訊篩選、表演、深海與化石專區；載入展覽的發掘動畫支援「減少動態效果」。下圖是開發時的介面紀錄；線上現況以[預覽站](https://event-radar-preview.onrender.com/)為準。

想快速評估專案，可依序閱讀：[目前進度](STATUS.md) → [面試用專案介紹](docs/portfolio-brief.md) → [面試技術學習手冊](docs/interview-study-guide.md) → [開發導覽](docs/development-guide.md) → [API 契約](docs/api.md)／[OpenAPI](docs/openapi.yaml) → [來源盤點](docs/sources.md) → [技術決策](docs/technical-decisions.md)。[Phase 8 文件驗收](docs/stage-2026-10-16-phase8.md)記錄當時的整理範圍與限制。

![Event Radar React 考古主視覺](docs/screenshots/event-radar-react-hero.jpg)

[早期首頁畫面](docs/screenshots/event-radar-showcase.png)保留作設計歷程。

[目前系統架構圖](docs/architecture.md#目前實作本機-mvp)、[資料庫 ERD](docs/erd.md)及[領域模型對照](docs/domain-model.md)分別說明執行流程、資料關聯與不同時間語意。長期概念圖中的多階段 Queue、通知與遠端監控仍未實作。

原始產品核心是臺灣博物館的特展與期間限定展；後續為驗證不同時間模型，另開表演藝術與海洋節目專區。三種資料各有查詢端點，不把演出、每日活動或市集混入特展結果。所有頁面均提供官方入口供訪客出發前核對。

目前是 **免費技術預覽**：React、讀取 API 與 Neon PostgreSQL 已公開運作，2026-10-17 線上 smoke 檢查通過，當時可搜尋 27 筆未結束特展。六個來源的雲端手動同步已成功；故宮北院官方資料網址從雲端抓取失敗，暫由本機工作站人工同步。六個來源的每週排程仍須經新 workflow 手動驗證及跨週觀察。本機 PostgreSQL Queue 不等於多階段 production Queue。一般入館票價與購票入口是人工核對資料，不等於每檔展覽票價；免費篩選只認來源明確標示。見[部署紀錄](docs/deployment.md)、[ER-91](docs/technical-decisions.md)及[票務來源與維護](docs/ticketing.md)。

## 來源與展示範圍

以下保留初期館所選擇的背景；**目前是否有自動 Adapter、人工快照或只有靜態導覽，請以[來源盤點](docs/sources.md)的現況矩陣為準**。表演、海洋節目與化石圖鑑是後續獨立加入的領域。

- **首批來源目標**：奇美博物館、國立自然科學博物館、國立臺灣博物館、國立故宮博物院（北／南院）、國立臺灣歷史博物館。
- **第二批**：國立科學工藝博物館、國立臺灣科學教育館、國立臺灣美術館、臺南市美術館。
- 奇美已列入資料來源表。官網有特展頁；目前未查到館方公開活動 API 文件。文化部 iCulture 展覽 JSON 可作不完整的補充來源，分段展期須與奇美官方逐筆頁交叉核對；既有人工整理資料保留。
- 科博館的[官方 OpenAPI](https://www.nmns.edu.tw/ch/about/info-central/opendata/index.html)個人金鑰已核發並在本機驗證。`NMNS_API_KEY` 優先供展覽與未來一週開放時間使用；無金鑰時展覽匯入仍可使用原 `NMNS_OPEN_DATA_URL`，開放時間只顯示官網核對入口。金鑰只存在 Git 忽略的本機 `.env`，不提交到 Git。
- 故宮南院的[當期展覽](https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3112)與[展覽預告](https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3111)是第三個真實來源。匯入有起訖日期的特別展覽與限期輪替展，保留官方詳情連結；無結束日的常設展與年度期程不列入搜尋。這是官方網頁同步，不是館方提供的公開 API。
- 故宮北院[公開展覽 JSON](https://odapi.npm.gov.tw/data/open/api/v1/exhibition/current.json)與海生館[公開特展 JSON](https://www.nmmba.gov.tw/OpenData.aspx?SN=BF6D6EB9CB6876BB)已接入本機。逐筆保留原始值，分流有效、待審與略過資料；故宮按院區與展期保守篩選。海生館若日期欄空白，僅對介紹文字明載完整展期的少數紀錄，再與同筆館方詳情頁的展名及日期核對；其他紀錄仍待審，不推測為常設展。用 `npm run review -- --source nmmba` 或 `--source npm-north` 查看待審原因。
- 首頁的「館所圖鑑」目前連到 14 篇人工編寫的介紹：十間原有博物館／美術館，加上臺中國家歌劇院、沖繩美麗海水族館、澎湖化石館與臺南左鎮化石園區。各頁的展示路線、平常開館資訊、照片來源與交通入口採人工核對，**不等於逐日開館或當期展件保證**；館方公告仍是出發前依據。臺博館、臺史博與科教館的近期特展尚未接入資料庫；沖繩與兩座化石館目前也只有靜態導覽。見[來源盤點](docs/sources.md)、[開館時間](docs/opening-hours.md)與[照片署名](web/photo-credits.html)。
- 導覽頁的地圖入口可選出發地，開啟外部路線；本站不計算即時車程、票價或最佳路線，也不儲存輸入地點。
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

若要先看介面，先執行 `npm ci`，再執行 `npm run preview`，開啟 `.env` 中 `PORT` 指定的本機網址；預設值請看 `.env.example`。`preview` 與 `start` 都會先建置 React 首頁；請擇一使用同一連接埠。預覽不需資料庫，頁面使用快照／示例資料，**不是即時同步**。

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d db
npm run migrate
npm run import:chimei:programmes # 可選：把已人工刷新之奇美活動快照匯入本機候選表
npm test
npm run check:docs
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

P7 已完成**現有本機功能**的 72 項單元、型別、React build、隔離 PostgreSQL／HTTP 整合及公開 GET OpenAPI 回應契約驗收；P8 文件與作品集資訊見[驗收紀錄](docs/stage-2026-10-16-phase8.md)。P9 免費技術預覽已完成單次部署與 smoke；來源跨週穩定、奇美特展正式自動匯入、沖繩自動來源、逐日特殊開館、線上排程、通知、搜尋流量與 AWS 尚未完成。不能把單次線上驗收寫成長期維運或真實使用成果。
