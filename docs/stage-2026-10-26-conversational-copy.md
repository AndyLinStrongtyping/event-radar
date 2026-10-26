# 圖鑑文案改寫：像分享逛館發現

使用者希望網站讀起來輕鬆，像聊天分享知識，而不是講義或訓話。本輪調整14館圖鑑的介紹、細節與延伸短文，以及左鎮館所介紹的照片導讀與部分科普。

## 寫作原則

- 從眼前看得到的細節開聊，例如電話交換機的插孔、陶壺的把手、白鯨的換氣。
- 少用「先看、再比較、分清、不要」等指令句；把知識直接說出來。
- 不強迫每篇都以提問或大道理收尾，也不編造本站親身感受。
- 保留原作與翻製、模型與化石、物種與當日展況的差別，用具體說明取代反覆提醒。
- AI圖像標示、資料來源、年代、展示限制仍保留。文案輕鬆不等於降低查證標準。

## 範圍與狀態

本輪是編輯既有內容，未另做全站逐頁改寫或新的學術考證。沒有改資料庫、來源匯入、API、排程及圖片。圖鑑仍是人工知識選讀，不是當日展件清單。

本機驗證：型別檢查、前端建置、兩項既有圖鑑測試、83份Markdown本機連結檢查與差異格式檢查通過。未新增文字快照測試；本機未重跑與文案無關的資料庫整合，發布CI另執行完整檢查。

## 公開發布結果

- 功能提交 `91ac0b71d3ba62f20db8a286a9ce945aea4bc717`，經[PR #25](https://github.com/AndyLinStrongtyping/event-radar/pull/25)合併；合併提交 `66e962bb1cb0562d7622e337c63c8d541f7fc934`。
- PR的兩組程式與資料庫檢查成功，main的[驗證工作](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/40327765105)成功。
- [GitHub Pages部署](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/40327765205)成功。瀏覽器重載[公開白鯨圖鑑](https://andylinstrongtyping.github.io/event-radar/explore/collections/?museum=nmmba)，已顯示「聊聊牠的日常」「有幾個細節滿有意思」及新版介紹。
- Render沒有重新部署；Pages圖鑑已更新，但連向Render的館所介紹（包括左鎮）尚未套用本輪修改。不能把Pages成功當作Render也已更新。
