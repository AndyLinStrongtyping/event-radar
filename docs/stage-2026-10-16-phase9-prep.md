# 2026-10-16｜Phase 9 部署前準備

本階段完成不需要平台帳號的程式、設定範本、驗收命令與[部署手冊](deployment.md)。**沒有建立 Neon／Render 資源、推送公開網站或開通任何付費服務。**

| 項目 | 本輪結果 | 限制 |
| --- | --- | --- |
| Render 設定 | `render.yaml` 指定單一免費 Node Web Service、手動部署、Singapore、健康檢查與秘密連線字串輸入 | 匯入 Blueprint 才會真的建立公開服務；平台設定仍須站長核對 |
| 啟動與環境 | `.node-version`、`start:prod`、`HOST`／`PORT` 驗證；頁面 build 留在部署 build 階段 | 遠端 `DATABASE_URL` 尚未設定或連線驗證 |
| 索引保護 | 未設 `PUBLIC_BASE_URL` 時回傳 `X-Robots-Tag: noindex` 且不提供 sitemap；設定 HTTPS 根網址後產生固定頁 sitemap 與 canonical | 預覽網址仍公開；免費 Web 休眠時平台可能阻擋爬蟲讀取 noindex；動態展覽沒有獨立 HTML 頁 |
| 驗收 | `smoke:deploy` 可檢查 health、React bundle、館所／展覽／表演／海洋 API、介紹頁與照片；預覽與正式索引分模式 | 本輪只在本機網址驗證，沒有 HTTPS 或雲端測試 |

驗證證據：`npm run typecheck` 通過、`npm test` 72/72 通過、`npm run build:web` 通過、`npm run test:integration` 隔離 PostgreSQL／HTTP 通過，`npm run smoke:deploy -- http://127.0.0.1:4101 --allow-local-http` 通過（本機當時有 11 館、28 筆可搜尋特展）。這些數字只代表**本機資料庫**，不代表新建 Neon 會自帶資料。

站長下班後才需要做：建立獨立 Neon 資料庫並保存 Secret，確認目標後執行 migration 與至少一館官方來源匯入，匯入 Render Blueprint，再以 `--expect-noindex` 做技術預覽 smoke。正式開放搜尋、Search Console、流量統計與常駐方案另行決策；線上穩定後才進 Phase 10 的 Queue／排程。完整步驟與故障處理見[部署手冊](deployment.md)。
