# Event Radar｜臺灣博物館特展情報

目標是從臺灣各博物館的官方資訊取得特展資料，整理展期、展館、城市與簡介，供人依地點與日期查詢，並回到官方公告核對。第一版聚焦**特展與期間限定展**，不收市集、音樂會或一般演出。

目前是 **v0.1 開發骨架**：資料庫、查詢 API、策展資料匯入、驗證測試與來源盤點已寫入。尚未完成自動抓取或公開部署，因此不列為作品集中的已完成系統。

## 範圍

- **首批來源目標**：奇美博物館、國立自然科學博物館、國立臺灣博物館、國立故宮博物院（北／南院）、國立臺灣歷史博物館。
- **第二批**：國立科學工藝博物館、國立臺灣美術館、臺南市美術館。
- 奇美已列入資料來源表。官網有特展頁；目前未查到公開活動 API 文件，先用可追溯的人工整理資料驗證產品流程，再確認正式取得方式與授權。
- 科博館的[官方公開特展 JSON 資料集](https://data.gov.tw/dataset/7499)可先介接；個人 API key 另候審查。公開資源網址從政府平台取得，放在本機 `NMNS_OPEN_DATA_URL`，不硬寫在程式。私人金鑰也不提交到 Git。

詳見 [需求規格](docs/requirements.md)、[API 契約](docs/api.md)、[來源盤點](docs/sources.md)與[每日同步運作設計](docs/operations.md)。

## 結構

```text
db/001_init.sql       PostgreSQL 資料表與索引
docs/                 需求、API、來源盤點
src/normalize.ts      特展資料驗證、正規化與 hash
src/ingest.ts         JSON 匯入指令
src/server.ts         查詢 API 與網站服務
web/                  搜尋介面與考古主視覺
test/                 測試與官方資訊範例
```

## 本機執行

需要 Node.js 22.10+、PostgreSQL 17 或 Docker。本機已確認 Node.js 24；Docker 目前未安裝或不在 PATH，資料庫端到端流程尚未驗證。

若要先看介面，執行 `npm run preview`，開啟 `http://127.0.0.1:4180/`。這個預覽不需資料庫，頁面會標示資料是官方頁快照，並可主動顯示模擬資料；**它不是即時同步**。主視覺採「考古探索未知文明」方向，使用專案內的原創影像資產。

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d db
$env:DATABASE_URL='postgres://event_radar:event_radar@localhost:5432/event_radar'
npm test
npm run ingest -- --file test/fixtures/chimei.json --source chimei
npm run ingest -- --file test/fixtures/nmns-mock.json --source nmns
# 從政府資料開放平台的「JSON」資源連結複製公開 URL 到本機環境變數後：
$env:NMNS_OPEN_DATA_URL='<官方 JSON 資源網址>'
npm run ingest -- --source nmns --official
npm start
```

已有 PostgreSQL 時，可手動執行 `db/001_init.sql`。試查詢：`http://127.0.0.1:3000/exhibitions?city=臺南市`。範例資料根據 [奇美博物館官方展覽頁](https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a68fa1d1a3b)記錄；展期與票價以館方最新公告為準。

## 已完成與未完成

已完成：規格、schema、手動 JSON 匯入、科博館公開 JSON adapter、查詢 API 程式、正規化單元測試、每日同步 workflow 設計。未完成：公開來源在本機的網路擷取與資料庫端到端驗證、奇美自動擷取、排程啟用、異動歷史、通知、部署。
