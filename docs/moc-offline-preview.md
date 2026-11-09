# 文化部展覽離線預覽

這項工具把文化部展覽資料整理成七館的候選清單，方便核對哪些是既有展覽、哪些值得再查。工具只寫本機報告，正式資料庫與公開查詢仍使用原有流程。

1. 讀取本機 JSON 或文化部展覽資料集的 JSON。保留來源 UID、原始展期、取得時間與檔案雜湊。
2. 清理場地和日期。遇到缺值、模糊館名、分類不明或互相矛盾的日期時，列為待審並保留理由。
3. 若有提供既有展覽快照，列出吻合、差異或缺少證據的欄位。結果只涵蓋該快照所收錄的資料。
4. 每次執行留下獨立版本。報告寫完才更新 `last-success.json`，失敗另存診斷。核對時以成功指標所指向的完整版本為準。

使用合成資料重現，不需要網路、資料庫或金鑰：

```sh
npm run preview:moc -- --input test/fixtures/moc-preview-sample.json --out private/moc-preview/sample
node --test test/moc-preview.test.mjs test/moc-preview-regression.test.mjs
```

需要試讀文化部來源時，可改用 `--fetch`。工具只發出一次請求，限制 30 秒與 20 MB，拒絕轉址。使用 `--baseline` 時，快照須有取得時間、明確範圍、完整分頁、唯一展覽 ID 及合法展期。

2026 年 11 月 2 日的 277 筆固定資料在修正後分為 3 筆欄位有效、142 筆待審、132 筆排除。20 筆目的抽樣曾經使用者核對，其中兩個不同年度的 UID 對應同一場奇美埃及展。有效筆數表示欄位通過檢查。這批資料仍留在離線報告，完整覆蓋率未評估。

程式入口見 [moc-preview-cli.mjs](../scripts/moc-preview-cli.mjs)。清理與比對在 [moc-preview.mjs](../scripts/moc-preview.mjs)，版本保存與失敗保護在 [moc-preview-store.mjs](../scripts/moc-preview-store.mjs)。

資料來源見[文化部展覽資訊 6012](https://data.gov.tw/dataset/6012)。
