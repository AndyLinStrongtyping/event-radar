# Event Radar 專案維護約定

- 實作新技術點、改變資料處理流程或改變已記錄的取捨時，於同一個提交更新 `docs/technical-decisions.md` 的對應 ER 編號；新增項目接續編號。
- 同步核對 `STATUS.md`，必要時更新 `docs/api.md`、`docs/architecture.md`、`docs/operations.md`。只把實際完成且有驗證證據的能力標成已實作；Render／Neon 公開預覽已上線，六個已啟用來源工作於 2026-10-20 第一次真實週排程成功，第二次排程與跨週穩定仍待觀察。故宮北院雲端工作獨立關閉；多階段 Queue、訂閱通知與 AWS 尚未完成。
- 資料來源與展期以館方及已確認的官方開放資料為準。無法驗證的來源紀錄保持待審，不要猜日期、票價或休館狀態。不得把 API Key、資料庫密碼或其他 Secret 寫入文件或 Git。
