# Phase 7｜工程品質驗收（2026-10-16）

本階段只驗收目前已實作的臺灣展覽、國美館美術、臺中國家歌劇院場次與海生館每日節目模型。沖繩及兩座化石館目前是靜態導覽，不冒充自動匯入來源；本機測試也不能證明跨週來源穩定或線上 CI 已通過。

| 驗收面向 | 本機證據 | 邊界 |
| --- | --- | --- |
| 單元測試與來源 Adapter | `npm test`：72 項通過；`test/nmns.test.ts`、`test/ntmofa.test.ts`、`test/domain-sources.test.ts` 等測試有效資料、格式錯誤及不安全推定 | 測試使用固定樣本，不會在 CI 即時抓取外站 |
| PostgreSQL 整合 | `npm run test:integration` 在隔離測試庫跑真實 SQL、匯入與 HTTP | 需要可建立測試資料庫的 PostgreSQL 帳號；不碰正式庫 |
| OpenAPI 回應 | `test/openapi.test.ts` 驗證引用與錯誤模型；整合測試逐條核對文件內公開 GET 路由的真實 HTTP 成功回應 | 管理端點不屬公開 OpenAPI；第三方站點的即時回應不在契約測試內 |
| Migration | 空庫重建、重跑零新增、既有庫基線、checksum 異動、未知帳本版本與中途缺版均驗證；`src/migrate.ts` 拒絕本機 SQL 編號不連續及帳本非前綴 | 基線只能驗證列出的必要結構，舊資料庫操作仍須先備份 |
| 冪等與異動 | 重複匯入不增筆、欄位變化寫入歷史；歌劇院場次人工覆核與新版來源失效、海生館時段變化均有隔離庫斷言 | 不把節目清單缺席直接解讀為取消 |
| EventSession 與 recurring schedule | 歌劇院多場次、狀態、票價與來源版本；海生館每日多時段、日期及筆數檢查；第 025 migration 的領域外鍵拒絕錯領域子資料 | 海生館觀察快照不預測未來每日節目 |
| Health／coverage／工作佇列 | 單元與整合測試涵蓋清單縮水、來源鍵替換、待審、重試成功後健康狀態、去重 job、租約回收、死信及 replay | 跨週穩定與正式環境告警尚未驗證 |
| CI | `.github/workflows/ci.yml` 在 push／PR 使用 Node 24 與 PostgreSQL 17，依序跑型別、單元及整合測試（整合測試前自動建置 React） | 本紀錄只證明同等本機命令通過；GitHub 上的當次 run 須另行查看 |

本機執行結果：`npm run typecheck`、`npm test`（72／72）、`npm run build:web`、`npm run test:integration` 均通過。整合測試中的「清單疑似不完整」與「沒有可公開展覽」訊息來自故意注入的異常案例，最終結果為通過。

仍需觀察的事項：官方來源跨週格式與涵蓋率、沖繩若改為自動來源後的 Adapter 契約、正式部署後的 CI／smoke test 與監控。這些不能靠一次本機測試宣稱完成。
