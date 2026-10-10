# 講義審查後的資料庫、就緒與 API 文件修正

日期：2026-10-11。對照[講義檢查表審查](review-2026-10-10-lecture-checklists.md)的三項優先缺口，實作細節見 [ER-36 至 ER-38](technical-decisions.md)。

1. **資料庫**：從空白 PostgreSQL 執行 `npm run migrate` 即可依序建立 001–012；每份腳本和 checksum 帳本在同一交易提交。重跑不重複套用。`compose.yaml` 不再讓容器自動執行 SQL，避免繞過帳本。已有舊結構時，普通命令拒絕冒險重跑初始 SQL；先備份與核對，再以 `npm run migrate -- --baseline-existing` 記錄已套用版本。基線會核對必要表、欄位和索引，缺漏就停止。館所參考列包含在初始腳本；沒有把假展覽灌入正式庫。
2. **就緒**：公開與本機管理服務在監聽前先查資料庫。啟動後公開 `/health` 查詢失敗會回 503／`NOT_READY`。
3. **API 文件**：`docs/openapi.yaml` 描述六個公開唯讀端點。管理表單和 CLI 不寫成不存在的公開 API。

已執行 `npm run typecheck`、`npm test`（37/37）及 `npm run test:integration`。整合測試用**隔離資料庫**驗證全新建置、重跑、舊庫拒絕與基線、匯入流程及公開 API；不會清空既有使用者資料庫。單元測試涵蓋資料庫不可連時不監聽、OpenAPI YAML 語法與引用。上述驗證不代表已公開部署、已有多使用者帳號或線上排程。

本機既有 `event_radar` 資料庫已另用 `pg_dump` 建立自訂格式備份，保存於 `C:\Users\user\AppData\Local\Temp\event-radar-pre-baseline-20261011.dump`；`pg_restore -l` 可讀取其目錄。其後 `--baseline-existing` 的結構核對通過、登記 12 份版本；再執行一般 `npm run migrate` 顯示新套用 0 份。沒有重建或清空既有展覽。
