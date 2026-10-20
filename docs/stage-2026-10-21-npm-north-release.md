# 2026-10-21 故宮北院部分涵蓋上線驗證

## 問題與處理

故宮北院官方「當期展覽」JSON 能讀取，但對照館方展覽頁時缺少〈真知灼見：美感原則與書法欣賞〉與〈養心：巨幅名作展〉。若把這份 JSON 當完整清單，後續可能誤判舊展已下架。修正後仍匯入合格資料，標記 `deferred_partial`，不覆寫完整度基準、不推進完整官方同步時間，也不依缺席隱藏展覽；缺漏的兩檔以獨立 `npm-north-manual` 來源補充。兩檔資料保留官方詳情網址，展期至 2026-12-27。

## 發布與資料更新紀錄

- 隔離 PostgreSQL 整合測試：人工補充第一次新增 2 筆、重跑新增 0 筆；79 項單元測試、型別與文件檢查通過。
- [PR #7](https://github.com/AndyLinStrongtyping/event-radar/pull/7) 的兩項 GitHub 檢查通過且無衝突，合併為 `e543883e56e305842823fe15cef302bd6206412f`。
- 寫入正式資料庫前，以 PostgreSQL 18 工具建立本機 custom-format 備份，存於非 OneDrive 的 `%LOCALAPPDATA%\EventRadar\backups`；檔案大小 146,891 bytes，SHA-256 為 `31e8bbd32bbbd343bdae52eaf2a92f4a13f2cb8a65a0829bd3c61fc7a8178ca7`。備份檔及密碼未提交至 Git。本次新備份尚未另做還原演練；先前的正式庫還原演練見[備份紀錄](stage-2026-10-18-neon-backup-drill.md)。
- 正式 Neon 先匯入人工補充：來源 2 筆，新增 2、待審 0。再次唯讀探測官方 JSON：HTTP 200，共 22 筆，其中合格 1、待審 15、略過 6，兩檔已知展覽仍缺席。再執行官方部分匯入：新增 0、未變更 1、缺席判定 0、`coverageStatus=deferred_partial`；完整度基準仍為 22 筆來源／1 筆合格，`last_official_success_at` 保留 2026-10-17 的值。
- Render [部署紀錄](https://dashboard.render.com/web/srv-db9hkpfavr4c73e40ahg/deploys/dep-dbbuu8bncjis73fdskc0) 從 `main` 的 `e543883` 建置成功，25 份 migration 中新增套用 0 份，首次資料檢查為 27 筆可展示限期展，服務狀態 `Live`。
- 部署後公開網站的故宮北院搜尋顯示 3 筆：〈龍藏經〉、〈養心〉、〈真知灼見〉。頁面同時顯示「官方展覽清單疑似不完整」及 15 筆待審提示；展覽卡片提供館方詳情連結。公開 API `/exhibitions?museum=npm-north&status=all` 回 200、`total=3`。

## 尚未解決的界線

這是有明確證據的兩檔人工補充，不是能發現所有新展的自動來源。故宮北院 GitHub 雲端週排程仍關閉；`odapi.npm.gov.tw` 的雲端連線逾時及官方 JSON 內容不完整，仍需向提供機關確認。已知展覽核對清單只在展期內發出缺漏警示，展期結束後不代表來源已恢復完整。後續每次人工更新仍須核對館方日期、詳情網址與待審狀態。
