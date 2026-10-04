# Event Radar｜臺灣博物館特展情報

![Event Radar 首頁作品畫面](docs/screenshots/event-radar-showcase.png)

目標是從臺灣各博物館的官方資訊取得特展資料，整理展期、展館、城市與簡介，供人依地點與日期查詢，並回到官方公告核對。第一版聚焦**特展與期間限定展**，不收市集、音樂會或一般演出。

目前是 **本機 MVP**：資料庫、查詢 API、科博館公開資料與故宮南院官方展覽頁匯入、奇美人工核對資料、七館常設展導覽、同館跨來源去重、欄位異動紀錄及測試已完成本機驗證。每日同步排程與 CI 已寫成 GitHub Actions 設定檔，但尚無 GitHub 遠端與公開部署，因此不列為作品集中的已上線系統。

## 範圍

- **首批來源目標**：奇美博物館、國立自然科學博物館、國立臺灣博物館、國立故宮博物院（北／南院）、國立臺灣歷史博物館。
- **第二批**：國立科學工藝博物館、國立臺灣科學教育館、國立臺灣美術館、臺南市美術館。
- 奇美已列入資料來源表。官網有特展頁；目前未查到公開活動 API 文件，先用可追溯的人工整理資料驗證產品流程，再確認正式取得方式與授權。
- 科博館的[官方公開特展 JSON 資料集](https://data.gov.tw/dataset/7499)可先介接；個人 API key 另候審查。公開資源網址從政府平台取得，放在本機 `NMNS_OPEN_DATA_URL`，不硬寫在程式。私人金鑰也不提交到 Git。
- 故宮南院的[當期展覽](https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3112)與[展覽預告](https://south.npm.gov.tw/ExhibitionsListC003110.aspx?Pindex=1&SearchAdvanced=False&appname=Exhibition3111)是第三個真實來源。匯入有起訖日期的特別展覽與限期輪替展，保留官方詳情連結；無結束日的常設展與年度期程不列入搜尋。這是官方網頁同步，不是館方提供的公開 API。
- 首頁的「常設展導覽」另有[奇美](web/guides/chimei.html)、[科博館（含植物園）](web/guides/nmns.html)、[臺博館](web/guides/ntm.html)、[臺史博](web/guides/nmth.html)、[故宮南院](web/guides/npm-south.html)、[科工館](web/guides/nstm.html)與[科教館](web/guides/ntsec.html)七頁人工編寫介紹。各頁加入可連回館方核對的特色展件／展項線索；奇美有樂器廳照片，科博館有木乃伊及使用者提供的展場照片，故宮南院有館舍與茶文化器物影像，科工館、科教館有官網照片（[圖片依據](docs/sources.md#常設展照片來源與使用)）。它們不是 API 同步資料，展件與開放狀態須以館方最新公告為準。除奇美、科博館與故宮南院以外，這些館所的近期特展尚未接入本站資料庫。未來的 React 視覺改版方向見[設計筆記](docs/react-visual-direction.md)。
- 七頁導覽新增交通規劃：可選出發縣市並選填更精確的地址或車站，分別開啟 Google Maps 大眾運輸與開車路線，旁邊保留館方交通連結。只選縣市時以該縣市政府作示意起點；本站不計算即時車程、票價或「最佳」交通方式，也不儲存輸入地點。
- 奇美公開特展頁已有**本機可執行的每週連結變更檢查**（`npm run check:chimei`）。GitHub Actions 排程檔設定為週一臺灣時間 09:20，但專案尚無 GitHub 遠端，因此線上排程尚未運作。檢查只讀官方公開頁與 `robots.txt`，比對頁面明確連出的個別特展網址；有新增、消失或頁面格式異常時失敗，提醒人工核對。這不是奇美 API 同步，不會改動資料庫，也不檢查音樂節、工作坊或售票名額。`data/chimei-known-links.json` 是核對後的基準，確認變更後才更新。

詳見 [需求規格](docs/requirements.md)、[API 契約](docs/api.md)、[來源盤點](docs/sources.md)與[每日同步運作設計](docs/operations.md)。

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
# 從政府資料開放平台的「JSON」資源連結複製公開 URL 到本機環境變數後：
$env:NMNS_OPEN_DATA_URL='<官方 JSON 資源網址>'
npm run ingest -- --source nmns --official
npm run ingest -- --source npm-south --official
npm start
```

已有 PostgreSQL 時，先執行 `db/001_init.sql`，再執行 `npm run migrate`。試查詢：`http://127.0.0.1:3000/exhibitions?city=嘉義縣`。也可匯入 `postman/EventRadar.postman_collection.json` 操作 API。奇美範例資料根據 [館方展覽頁](https://www.chimeimuseum.org/special-exhibition/68a68f0a422a6/68a68fa1d1a3b)記錄；展期與票價以館方最新公告為準。

## 已完成與未完成

已完成：規格、schema 與 migration、手動 JSON 匯入、科博館公開 JSON adapter、故宮南院官方頁 adapter、查詢 API、網站介面、同館跨來源保守去重、欄位異動歷史、單元與資料庫整合測試，以及每日同步與 CI workflow 設計。未完成：奇美自動擷取、線上排程／CI 啟用、跨館同展關聯、通知、公開部署與 AWS。
