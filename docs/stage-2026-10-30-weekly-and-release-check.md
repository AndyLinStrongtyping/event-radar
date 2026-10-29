# 2026-10-30｜第二次週排程與主站發布核對

## Render部署完成追加驗收

使用者提供的Render日誌顯示main提交73e6e5ee952f86ad329c25b00c1a43a89d409b50建置完成，並於2026/10/30臺灣時間00:28:55回報Live。25份migration均已存在，新套用0份；已有32筆特展，bootstrap略過首次匯入。

公開HTTP驗收結果：

- scripts/smoke-deploy.mjs通過：健康、資料庫、首頁建置、11館、32筆可搜尋特展、表演及海洋節目回應、三個主題頁、圖鑑與指定圖片正常。
- 圖鑑網址200；讀取頁面引用的兩個JavaScript建置檔，確認包含「聊聊牠的日常」「有幾個細節滿有意思」及atlas-beluga-3d-aged-v2.webp。
- 左鎮館所介紹200，已包含學長科普的新標題與zuojhen-evolution-hall-user.jpg。
- 以上為HTTP與建置內容驗證，未做本輪瀏覽器視覺、手機實機或GA4事件驗收。

先前404與舊文案的紀錄保留在下方，代表部署前狀態，已由此次部署解決。

日誌仍有PostgreSQL SSL模式相容性警告；當次連線與migration成功，警告未清除。未修改正式連線字串或降低憑證驗證。.env不存在不影響此次部署，服務使用Render環境變數且資料庫健康檢查正常。

## 排程證據

- [10/27 真實排程](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/40422703506)事件為 schedule，來源提交為3478567b61d52673fd17f2ea792cd4210e9d8cec，整體結果success。
- 臺灣時間2026/10/27 07:52:34建立，晚於設定的04:15；不能宣稱準點執行。
- 科博館、故宮南院、海生館、科工館、國美館、歌劇院六個工作success；故宮北院skipped，符合獨立關閉設定。
- 對照[10/20第一次](https://github.com/AndyLinStrongtyping/event-radar/actions/runs/39343053279)，已有連續兩週真實排程成功證據。
- 這是工作執行成功，未據此宣稱每館完整涵蓋、待審清零、全部資料更新或長期永不失敗。本次未讀取私有資料庫或完整匯入log核對筆數。

## 部署前Render公開HTTP核對（歷史紀錄）

- /health：200，status=ok、database=ok。
- /museums：200，11筆館所。
- /exhibitions?limit=1：200，total=32。
- /explore/collections/：404；主站尚無這批圖鑑。
- /guides/zuojhen-fossil.html：200，但缺少本輪圖鑑入口與新版學長科普標題，仍是舊版。
- 因此僅能確認主站核心讀取正常，不能標示整批發布驗收通過。GitHub Pages前端發布與Render部署是兩件事。

## 當時待完成的部署（已完成，見上方追加驗收）

在[Render服務](https://dashboard.render.com/web/srv-db9hkpfavr4c73e40ahg)完成登入，核對main版本，再選Manual Deploy → Deploy latest commit。不變更方案、環境變數或正式資料。

部署流程本來會執行migration及bootstrap；本輪圖鑑與文案未新增migration，但仍須查看實際部署日誌。完成後使用scripts/smoke-deploy.mjs驗收，並確認圖鑑圖片與左鎮新版文案。

本回合沒有可用的網頁控制工具，因此未執行Render手動部署；沒有修改正式資料庫、帳密、排程或付費方案。

## 本機位置

原Desktop/新增資料夾 (3)/-已移為Desktop/stellarskill/-。現有工作副本event-radar-persona-release的Git狀態乾淨，已快轉同步origin/main。先前沙箱內Git存取失敗屬新路徑權限限制，非已證實的Git損壞。
