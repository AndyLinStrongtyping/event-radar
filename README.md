# Event Radar｜臺灣博物館特展情報

**2026-10-05 第四階段更新：**科博館個人 API Key 已在本機驗證並接入當期展覽與未來一週開放時間；搜尋頁新增休館提醒與奇美館方行事曆／消息入口。詳細狀態見[統一進度](STATUS.md)與[第四階段紀錄](docs/stage-2026-10-05-phase4.md)。

目前做到哪裡、哪些尚未接入：請先看 [統一進度](STATUS.md)。

![Event Radar 首頁作品畫面](docs/screenshots/event-radar-showcase.png)

目標是從臺灣各博物館的官方資訊取得特展資料，整理展期、展館、城市與簡介，供人依地點與日期查詢，並回到官方公告核對。第一版聚焦**特展與期間限定展**，不收市集、音樂會或一般演出。

目前是 **本機 MVP**：資料庫、查詢 API、五館公開資料或官方頁匯入、文化部奇美補充來源、九館常設展導覽、來源隔離、本機審核頁、有限重試及嘗試紀錄、同館去重、欄位異動紀錄與測試已完成本機驗證。搜尋可按展覽狀態與明確免費資訊篩選；現有來源多數沒有可靠票價，所以免費結果可能為空。[最新階段紀錄](docs/stage-2026-10-05-phase5.md)列出實測與索引判斷。每日同步排程與 CI 已寫成 GitHub Actions 設定檔，但線上每日同步與公開網站尚未啟用，因此不列為已上線系統。

## 範圍

- **首批來源目標**：奇美博物館、國立自然科學博物館、國立臺灣博物館、國立故宮博物院（北／南院）、國立臺灣歷史博物館。
- **第二批**：國立科學工藝博物館、國立臺灣科學教育館、國立臺灣美術館、臺南市美術館。
- 奇美已列入資料來源表。官網有特展頁；目前未查到館方公開活動 API 文件。文化部 iCulture 展覽 JSON 可作不完整的補充來源，分段展期須與奇美官方逐筆頁交叉核對；既有人工整理資料保留。
- 科博館的[官方 OpenAPI](https://www.nmns.edu.tw/ch/about/info-central/opendata/index.html)個人金鑰已核發並在本機驗證。`NMNS_API_KEY` 優先供展覽與未來一週開放時間使用；無金鑰時展覽匯入仍可使用原 `NMNS_OPEN_DATA_URL`，開放時間只顯示官網核對入口。金鑰只存在 Git 忽略的本機 `.env`，不提交到 Git。
- 故宮南院的[當期展覽](https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3112)與[展覽預告](https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3111)是第三個真實來源。匯入有起訖日期的特別展覽與限期輪替展，保留官方詳情連結；無結束日的常設展與年度期程不列入搜尋。這是官方網頁同步，不是館方提供的公開 API。
- 故宮北院[公開展覽 JSON](https://odapi.npm.gov.tw/data/open/api/v1/exhibition/current.json)與海生館[公開特展 JSON](https://www.nmmba.gov.tw/OpenData.aspx?SN=BF6D6EB9CB6876BB)已接入本機。逐筆保留原始值，分流有效、待審與略過資料；故宮按院區與展期保守篩選，海生館缺起訖日不推測為常設展。用 `npm run review -- --source nmmba` 或 `--source npm-north` 查看待審原因。
- 首頁的「常設展導覽」另有[奇美](web/guides/chimei.html)、[科博館（含植物園）](web/guides/nmns.html)、[臺博館](web/guides/ntm.html)、[臺史博](web/guides/nmth.html)、[故宮南院](web/guides/npm-south.html)、[科工館](web/guides/nstm.html)、[科教館](web/guides/ntsec.html)、[故宮北院](web/guides/npm-north.html)與[海生館](web/guides/nmmba.html)九頁人工編寫介紹。多頁附照片及[圖片依據](docs/sources.md#常設展照片來源與使用)。它們不是 API 同步資料，展件與開放狀態須以館方最新公告為準。臺博館、臺史博與科教館的近期特展尚未接入本站資料庫。未來 React 視覺改版方向見[設計筆記](docs/react-visual-direction.md)。
- 九頁導覽都有交通規劃：可選出發縣市並選填更精確的地址或車站，分別開啟 Google Maps 大眾運輸與開車路線，旁邊保留館方交通連結。只選縣市時以該縣市政府作示意起點；本站不計算即時車程、票價或「最佳」交通方式，也不儲存輸入地點。
- 奇美公開特展頁已有**本機可執行的每週連結變更檢查**（`npm run check:chimei`）。該檢查與文化部補充匯入互相獨立；前者比對官網初始 HTML 明確列出的連結，後者只納入能通過官網逐筆核對的文化部資料，兩者都不保證完整奇美展覽清單。線上排程尚未啟用。

詳見 [需求規格](docs/requirements.md)、[API 契約](docs/api.md)、[來源盤點](docs/sources.md)、[官方 API／第三方資料源查證](docs/api-source-research.md)、[每日同步運作設計](docs/operations.md)與[後續方向（館所與 Queue）](docs/future-roadmap.md)。

## 結構

```text
db/                    PostgreSQL 初始化與後續 migration
docs/                 需求、API、來源盤點
src/normalize.ts      特展資料驗證、正規化與 hash
src/ingest.ts         JSON／官方來源匯入與整批回滾
src/server.ts         查詢 API 與網站服務
web/                  搜尋介面與考古主視覺
test/                 測試與官方資訊範例
```

## 本機執行

需要 Node.js 22.10+、PostgreSQL 17 或 Docker。本機已用 Node.js 24 與 Docker Desktop 的 PostgreSQL 17 驗證資料匯入和 API。此電腦的 Docker 執行檔位於使用者目錄，若終端機找不到 `docker`，可呼叫 `C:\Users\user\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`。

若要先看介面，執行 `npm run preview`，開啟 `http://127.0.0.1:4180/`。這個預覽不需資料庫，頁面會標示資料是官方頁快照，並可主動顯示模擬資料；**它不是即時同步**。主視覺採「考古探索未知文明」方向，使用專案內的原創影像資產。

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d db
$env:DATABASE_URL='postgres://event_radar:event_radar@localhost:5432/event_radar'
npm run migrate
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
npm run sync:status
# 僅限本機管理頁，需另外設定至少 16 字元的 EVENT_RADAR_ADMIN_PASSWORD
npm run admin
npm start
```

已有 PostgreSQL 時，先執行 `db/001_init.sql`，再執行 `npm run migrate`。試查詢：`http://127.0.0.1:3000/exhibitions?city=嘉義縣`。也可匯入 `postman/EventRadar.postman_collection.json` 操作 API。奇美範例資料根據 [館方展覽頁](https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a68fa1d1a3b)記錄；展期與票價以館方最新公告為準。

## 已完成與未完成

已完成本機驗證：規格、schema 與 migration、科博館私人 Key 展覽／開放時間 API、其他四館公開資料或官方頁 adapter、文化部奇美補充 adapter、查詢 API、休館提醒介面、原始資料隔離、密碼保護的本機審核頁、有限次來源重試與嘗試紀錄、同館跨來源保守去重、欄位異動歷史、單元與資料庫整合測試。未完成：奇美新聞自動同步、其他館逐日休館資料、持久化 Queue／worker、線上每日同步、跨館同展關聯、通知、公開部署與 AWS。
