# 2026-10-21 故宮北院第二輪漏展稽核

## 發現

以瀏覽器開啟故宮[當期展覽](https://www.npm.gov.tw/Exhibition-Current.aspx?l=1&sno=03000060)與[展覽預告](https://www.npm.gov.tw/Exhibition-Preview.aspx?l=1&sno=03000061)，再逐頁核對下列館方詳情。相同日期，唯讀查詢現用官方 `current.json`，以這四檔展名比對均無紀錄。館方頁可讀不代表 GitHub runner 能連上該 JSON，也不代表列表涵蓋所有新展。

| 展覽 | 館方展期 | 展廳 | 官方詳情 |
| --- | --- | --- | --- |
| 匯流1950：新入藏文物風華 | 2026-09-11 至 2028-09-10 | 北部院區第一展覽館 304 | [04014553](https://www.npm.gov.tw/Exhibition-Content.aspx?l=1&sno=04014553) |
| 物華再現：文物保存修復 | 2026-10-08 至 2027-01-03 | 北部院區第一展覽館 105、107 | [04014556](https://www.npm.gov.tw/Exhibition-Content.aspx?l=1&sno=04014556) |
| 獨具慧眼：美感原則與繪畫欣賞 | 2026-10-09 至 2026-12-27 | 北部院區第一展覽館 210、212 | [04014550](https://www.npm.gov.tw/Exhibition-Content.aspx?l=1&sno=04014550) |
| 國寶聚焦 2026-III | 2026-10-09 至 2026-12-27 | 北部院區第一展覽館 208 | [04014552](https://www.npm.gov.tw/Exhibition-Content.aspx?l=1&sno=04014552) |

〈匯流1950〉是明確起訖的 730 天展覽，符合現行「**超過**兩年才待審」規則；這個時長不是由標題推斷。其他長期或無完整結束日的 15 筆待審紀錄沒有因此核准，其中也包含非北院展，待審數不等於當期漏展數。

## 處理與驗證

四檔加入 `data/npm-north-verified-supplement.json`，沿用獨立 `npm-north-manual` 來源及館方展覽編號作冪等鍵；該檔現有六筆。`probe:npm-north` 的已知展比對同步擴為六筆，僅在展期內警示缺漏。2026-10-21 唯讀探測回 HTTP 200、22 筆來源、1 筆合格、15 筆待審、6 筆略過，六檔已知展均未出現在可公開清單；因缺漏而回非零碼是預期警示。80 項單元測試、TypeScript 型別檢查、67 份文件連結檢查與隔離 PostgreSQL 完整整合測試通過；整合測試先建立既有兩筆，再以六筆補充檔匯入，確認只新增四筆、兩筆未變；重跑零新增且六筆未變，人工來源不推進官方完整同步時間。這是隔離庫結果，正式庫在本次提交前已有前兩筆。

## 正式匯入與標示修正

PR [#9](https://github.com/AndyLinStrongtyping/event-radar/pull/9) 的兩項 CI 均通過並已合併。先以 PostgreSQL 自訂格式建立正式 Neon 備份，大小 147,498 bytes，SHA-256 `2d79406d326ec9ed0b930272ed89943bb7408b4dab1df7998884b39da454374b`，存於本機 `%LOCALAPPDATA%/EventRadar/backups`。接著由維運工作站以 `npm-north-manual` 匯入六筆，結果 `fetched=6, inserted=4, updated=0, unchanged=2, review=0`。公開 `GET /exhibitions?museum=npm-north&status=all&limit=100` 回 200、`total=7`，包含原有〈龍藏經〉與六筆人工補充，各標題、展期、官方詳情 URL 均已比對。

公開 API 也暴露既有標示問題：展覽的 `sourceStatus` 原先直接取館所的 `open_data`，導致這六筆人工核對展覽在卡片上被稱為「公開資料」。後續修正用單筆展覽的 `primary_provider` 判別：`npm-north-manual` 回 `curated`，官方 JSON 仍回 `open_data`；整合測試同時查清單及詳情。此修正尚須部署後核對公開回應，不能在部署前宣稱標示已修好。

即使六筆全數顯示，仍只表示六檔已知漏展有資料，不能稱故宮北院自動清單完整或啟用雲端週排程。
