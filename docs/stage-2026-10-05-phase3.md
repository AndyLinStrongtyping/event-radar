# Event Radar｜第三階段紀錄（2026-10-05）

接續[第二階段](stage-2026-10-05-phase2.md)的六項工作。本階段將第 6 項拆成「先把程式碼存到使用者自己的獨立 GitHub repo」與「日後才建置公開網站及線上資料庫／同步」。**目前仍是本機網站，未部署、未接 AWS，也沒有線上每日資料更新。**

## 已完成

1. 新增獨立的本機審核服務 `src/admin-server.ts`，預設只聽 `127.0.0.1:3010`，需另外設定 16 字元以上的管理密碼。登入有嘗試次數限制、短期記憶體 session、HttpOnly／SameSite cookie、Origin 和 CSRF 檢查；讀取待審原始資料、開館方證據頁、填日期及審查說明。補正交易抽出至 `src/review-service.ts`，命令列與管理頁共用。**只開放海生館、故宮北院的補正；證據頁內容須審查人自行核對。**不能把此單一管理密碼當作多使用者 RBAC，也不應把本機管理頁直接對外公開。
2. `db/005_sync_attempts.sql` 留下每次來源同步的狀態、時長、錯誤及是否可重試；`npm run sync:status` 呈現最近嘗試、七日失敗／重試數與待審量；`npm run sync:failed -- --source <館別>` 只重跑最近失敗的單一來源。這是有紀錄的程序重試，**不是 Queue、worker 或自動告警**。
3. 科工館採[官方展示廳公開 JSON](https://websrv.nstm.gov.tw/OtherInfo/OpenData/ExhibitionInfoOpenData.ashx)加[官方當期特展列表](https://www.nstm.gov.tw/ExhibitionList.aspx?ExhibitionType=2&Period=2&Pindex=1)交叉核對。只有展名與展期唯一吻合，才存入逐筆館方詳情網址；其餘隔離。2026-10-05 本機實測 8 筆尚未結束的特展候選，7 筆匯入、1 筆待審；第二次經 `sync` 執行為 7 筆不變，成功嘗試有日誌。
4. 奇美的[文化部 iCulture 展覽 JSON](https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=6)接為**補充來源**：只取奇美相關資料、排除常設展、合併同一特展相鄰的分段日期，並向奇美官方逐筆頁核對完整展期。本機實測 10 筆相關原始紀錄，1 筆通過並連結既有展覽，8 筆隔離。文化部不是奇美官方 API；尚未證明 JSON 回應有完整分頁或涵蓋所有奇美展覽，因此未納入每日 workflow。
5. 故宮北院加入 2017 年館舍外觀照片，海生館加入 2013 年海藻森林展缸照片，皆來自 Wikimedia Commons 個別檔案頁。頁面標示作者、授權與拍攝時間；照片為歷史展場／館舍紀錄，**不是當期展示保證**。詳見[圖片依據](sources.md#常設展照片來源與使用)。
6. 已在 `AndyLinStrongtyping` 帳號建立**私人**的獨立 [event-radar repo](https://github.com/AndyLinStrongtyping/event-radar)，與 Stellar Archive 團隊 repo 無關。程式碼已推送到 `main`；首次 [GitHub 測試 CI](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/37254843421) 成功。線上同步 workflow 與奇美每週檢查都以 `EVENT_RADAR_SYNC_ENABLED` 閘門預設關閉。

## 驗證與限制

- `npm run typecheck`、`npm test`（20/20）、`npm run test:integration` 通過。整合測試涵蓋管理頁未登入拒絕、跨來源表單與無效 CSRF 拒絕，以及原有匯入回滾、去重與異動紀錄。
- 瀏覽器實測發現同來源表單會傳 `Origin: null`；已限定必須同時具備 `Sec-Fetch-Site: same-origin` 並驗證 loopback Host，保留跨站拒絕。修正後登入、待審清單及單筆補正表單可在本機 Chrome 實際操作，尚未送出任何人工補正。
- 新增資料庫 migration `005_sync_attempts.sql`、`006_nstm.sql` 已在本機套用；科工館與文化部奇美都對官方即時資料執行過匯入。`sync:failed` 曾在沒有失敗紀錄時正確跳過；未做故障注入，不能宣稱已驗證真實第三方服務恢復。
- 科博館私人 Key 尚未提供；現有公開 JSON 匯入不會假裝是私人 API。Key 核發後仍須驗證回應格式、授權、分頁、速率限制，再決定是否替換 adapter。
- 遠端 PostgreSQL、Repository Secret、線上同步、正式網站、Queue、通知與 AWS 均未建立或啟用。推送程式碼只會觸發測試 CI。網站先維持本機預覽。
