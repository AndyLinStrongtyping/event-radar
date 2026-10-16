# Phase 8｜文件與作品集驗收（2026-10-16）

本階段整理**現有本機系統**的對外說明，不改匯入或公開 API 行為，也不提前啟用部署。路線圖的 Phase 1／2／4 來源涵蓋率與跨週穩定仍有未結項；Phase 5 沖繩只有人工靜態導覽，不能因 P8 文件完成就宣稱所有來源完成。

| 交付 | 本次核對重點 |
| --- | --- |
| [README](../README.md) | 第一屏呈現多領域能力、來源等級與未部署狀態；本機指令從 `.env.example` 建立 `.env`，不在文件寫死連接埠 |
| [目前架構圖](architecture.md#目前實作本機-mvp) | 分開畫限期展來源路徑及表演／海洋領域路徑；靜態導覽不畫成自動來源，長期 PNG 標示概念 |
| [ERD](erd.md)與[模型對照](domain-model.md) | ERD 只畫 migration 中有外鍵的主要關係，指出 `domain_events` 和觀察快照的特殊邊界；日期範圍、逐場及當日觀察不混用 |
| [技術決策](technical-decisions.md) | 新增 ER-84 說明作品集文件的能力／證據分級；保留先前技術取捨的歷史 |
| [來源盤點](sources.md) | 以本機 Adapter、人工候選、靜態導覽分級；不把奇美內部端點稱公開 API |
| [路線圖](future-roadmap.md)與[STATUS](../STATUS.md) | P8 標完成，P9 仍待開始，並保留前面階段未結可靠性項目 |
| [API 說明](api.md)與[OpenAPI](openapi.yaml) | 人類可讀清單補 `/marine-observation-days`；機器契約仍以現有公開唯讀 GET 路由為準，本階段沒有新增 API |
| [面試介紹](portfolio-brief.md) | 只引用可查的本機測試及有日期的手動同步，不使用虛構公開網址、使用者、營收或 SLA |

## 驗證

- `npm run check:docs`：54 份 Markdown 的相對檔案連結通過；CI 已加入同一命令，尚未核對此次 GitHub run。不保證外部網址、頁內錨點或 Markdown 在所有平台上的渲染。
- `npm test`：72／72 通過，含原有單元與 OpenAPI 契約檢查；這是避免文件整理意外破壞可執行規格，不是重新核對館方即時內容。
- `npm run typecheck` 與 `npm run build:web`：均通過，確認文件整理沒有影響程式與介面建置。
- Phase 7 曾通過隔離 PostgreSQL／HTTP 整合測試；本次沒有改資料庫、公開路由或資料處理，不把該次本機測試說成正式環境驗證。

## 交給 Phase 9 的明確邊界

公開測試版需先決定對外保留哪些來源及人工／靜態提示，再建立遠端 PostgreSQL、環境 Secret、migration、公開 API 與 React 網站的網路路徑，驗證 CORS、HTTPS、健康檢查、部署後 smoke test 和版本 SHA。管理頁目前只綁本機，不能直接暴露。部署穩定後才啟用 production Queue／排程／主動告警；AWS 仍非首版要求。
