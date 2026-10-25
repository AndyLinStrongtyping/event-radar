# 2026-10-25 搜尋內容第一批實作與驗證

## 範圍

- 首頁以「近期展覽」說明產品用途；展名搜尋與城市、館所選單的提示符合實際 API 行為。
- 首頁、深海與化石頁在初始 HTML 保留主標題、說明與館所連結。React 載入後仍顯示原本互動內容；不以初始 HTML 宣稱即時活動場次。
- 故宮北院、奇美、左鎮、澎湖四頁的 title／description 對應內文；奇美與左鎮補可核對的門票、資格及官方導覽入口。票價均有核對日期與出發前再確認提醒。故宮票價因官方頁無法由本次工具讀取，僅提供官方票務及購票入口，不推測金額。
- 不建立沒有實際清單的城市頁，不宣稱已取得關鍵字搜尋量。

## 官方來源核對

- 奇美[參觀指南](https://www.chimeimuseum.org/visit)、[導覽服務](https://www.chimeimuseum.org/visit/60b8a81e414b4/654c9458b7577)及[官網所連的售票頁](https://chimeimuseum.fonticket.com/)：常設展全票 NT$200、優惠票 NT$150，資格需證件，特展及導覽另查。
- 左鎮[票價](https://fossil.tnc.gov.tw/content/index.php?m2=52)與[開放時間](https://fossil.tnc.gov.tw/content/index.php?m2=51)：全票 NT$100、優惠 NT$70、半票 NT$50，週三例休，證件與當日例外依官網。
- 故宮北院[票務](https://www.npm.gov.tw/Articles.aspx?l=1&sno=02007004)本次讀取受限；未重新宣稱具體價格。

## Search Console 基準

2026-10-25 在使用者的 Search Console 資源 `https://event-radar-preview.onrender.com/` 直接檢查：

- 首頁網址審查顯示「網頁已編入索引」，上次 Googlebot 手機檢索 2026-10-17，擷取成功，Google 選用受檢測網址作標準網址。
- Sitemap 於 2026-10-25 讀取成功，發現 17 個網址。
- 索引總覽更新日期仍是 2026-10-16，顯示 0 已索引，不應用過時總覽否定首頁網址審查結果。
- 故宮北院、左鎮與深海頁顯示已發現但尚未索引；化石頁顯示 Google 尚未辨識該網址。奇美頁的索引紀錄顯示 2026-10-21 曾遭 robots.txt 封鎖；目前公開 robots.txt 已 `Allow: /`，Search Console 2026-10-25 即時測試顯示「網頁可編入索引」。歷史封鎖仍需等 Google 重新檢索才會消失。

這些結果證明網站可讓 Google 發現部分頁面；不保證其餘頁面已收錄、排名或流量。發布後再對變更頁做即時網址檢測並按週觀察，避免短時間重複要求索引。

## 驗證與發布狀態

本機 `npm test` 82/82、`npm run typecheck`、`npm run build:web`、`npm run check:docs` 通過。上線後仍需檢查首頁與六個代表頁的 200、初始 HTML、canonical、robots、sitemap、圖片與搜尋 API；本節在發布前不記為已上線。
