# 官方 API 與替代資料源盤點（2026-10-04）

本頁只記錄找到的公開說明與待驗證事項，**沒有新增匯入器或啟用同步**。區分「館方 API」、「館方資料在政府開放資料平臺的 JSON 資源」與「跨館彙整資料」；JSON 下載網址不一定代表可查詢的 API，也不代表資料即時。接入前須實測回應、資料涵蓋率、展期欄位與官方詳情連結。

| 來源 | 已查到的展覽資料 | 金鑰／申請 | Event Radar 用途與限制 |
| --- | --- | --- | --- |
| 科博館 | [館方資訊開放專區](https://www.nmns.edu.tw/ch/about/info-central/opendata/index.html)列 `/opendata/Exhibition/list`（當期展覽）與 `/opendata/Event/list`（本館及三園區活動）；另有 [data.gov.tw 特展 JSON](https://data.gov.tw/dataset/7499) | [館方 API Key 申請頁](https://www.nmns.edu.tw/ch/about/info-central/opendata/apply/index.html)；申請通過後，以 HTTP header `apiKey` 傳遞 | 最適合等金鑰核發後測試的館方 API。現有程式使用公開 JSON 資源；兩者結構不應假設相同。921 園區活動另有[公開 JSON 資料集](https://data.gov.tw/dataset/7500)，但活動不一定是特展。 |
| 故宮北院 | [官方當期展覽 JSON](https://data.gov.tw/dataset/169167)，欄位含 `sno, link, title, time, location, description`，來源指向故宮開放資料服務 | 資料集頁提供 JSON 連結，未在該頁列出申請程序；故宮另有舊版 [Open API／Key 說明](https://openapiweb.npm.gov.tw/APP_Prog/eng/overview_eng.aspx)，但本次重新開啟該說明頁會轉到錯誤頁，申請狀態**未確認** | JSON 可讀，但實測混入南院與已結束展覽；必須按 `location` 分院區、按 `time` 驗證展期。舊版 Key 說明不可當作目前可申請的保證。 |
| 科工館 | [展示廳資訊 JSON](https://data.gov.tw/dataset/7177)列常設展與特展及展期；[歷年展覽 JSON](https://data.gov.tw/dataset/27267)有較完整欄位 | 資料集頁提供 JSON 連結，未列申請 Key | 可先做來源樣本測試，但展示廳資訊標示每 6 個月更新，歷年展覽標示每年更新；須確認當期資料的新鮮度，不能承諾每日新增展覽。 |
| 海生館 | [特展介紹 JSON](https://data.gov.tw/dataset/90320)，列名稱、內容、地點與 app 用起訖時間 | 資料集頁提供 JSON 連結，未列申請 Key | 值得試做 adapter；資料集標示每年更新，需核對起訖時間是否代表真實展期、是否仍在展出。 |
| 故宮南院 | 目前以館方當期／預告頁匯入 | 尚未確認有專屬的公開展覽 API | 保留現有官方頁來源。不要把北院 JSON 或舊版故宮 Open API 自動視為涵蓋南院。 |
| 奇美、臺博館、臺史博、科教館、袖珍、黃金、鶯歌陶博 | 各館官方展覽頁可供人工核對；此次未確認可直接使用的**館別專屬展覽 API** | 未確認可申請的展覽 API Key | 先查館方公開資料或以跨館來源比對，再決定是否需向館方詢問介接。奇美仍為人工核對，不使用其網站內部端點冒充公開 API。 |

## 跨館及第三方候選

- **文化部 iCulture 展覽資訊**：[官方開放資料頁](https://opendata.culture.tw/frontsite/openData/detail?datasetId=266)及 [data.gov.tw 資料集](https://data.gov.tw/dataset/6012)提供類別 6「展覽」JSON／XML，資料集標示每日更新、政府資料開放授權條款第 1 版，且列有 OAS API 說明。它聚合公私單位，適合作為跨館補充來源；目前**未確認**上述每一家館都有資料。需依主辦單位、場地、官方連結過濾，並與館方來源去重；資料集頁未寫需申請 Key。
- **TDX 觀光資訊 API**：[交通部 TDX 觀光 API 說明](https://tdx.transportdata.tw/api-service/swagger/tourism/0aed433a-9e95-404d-974c-4e70e29ae460)含活動訊息，註冊後以 Client Id／Client Secret 使用。可作候選比對來源，但屬廣義觀光活動，博物館特展覆蓋率、更新速度及可回連的官方頁均待實測；不宜取代館方展覽資料。
- **國家文化記憶庫 OpenAPI**：[官方說明與申請](https://tcmb.culture.tw/zh-tw/OpenApi)要求 API Key、申請理由與固定連線 IP。但官方說明重點在文化素材與圖像詮釋資料，**不是當期博物館特展清單**；目前不列為特展匯入來源。它可留作將來經授權的展件／背景知識補充。
- 票務平台、旅遊部落格、社群頁與搜尋結果不能因公開可見就當作可再利用 API；若日後考慮，逐一核對條款、來源歸屬與資料更新機制。

## 建議驗證順序

1. 科博館 Key 核發後，以官方文件和匿名化樣本核對 `/opendata/Exhibition/list` 的展期、分頁、速率限制，再決定是否替換現有公開 JSON adapter。
2. 實測故宮北院 JSON 的當期筆數及日期解析；再試科工館與海生館 JSON，特別檢查資料新鮮度。
3. 取文化部展覽資料樣本，量測目標館所覆蓋率和同一展覽的重複率，才決定是否納入第二來源。
4. 對未找到專屬 API 的館所先保留「待確認」，不要宣稱無 API；必要時向館方詢問可用資料與授權方式。

金鑰只放伺服端環境變數／Secret，不寫入前端、範例或 Git。研究連結是入口證據；實際可用性、授權細節與內容範圍仍須於開發當天再次核對。

## 公開 JSON 實際回應抽查（2026-10-04）

以下是**唯讀請求當下的樣本結果**，不是已匯入資料，也不是每日會維持的筆數。查詢僅用官方或政府資料集列出的網址；沒有使用使用者的私人 API Key。

| 來源 | 回應與發現 | 接入前必須處理 |
| --- | --- | --- |
| [故宮「北院當期」JSON](https://odapi.npm.gov.tw/data/open/api/v1/exhibition/current.json) | HTTP 可讀，共 22 筆；`location` 文字分出北院 17、南院 3、未明確標示 2。前幾筆含 2026-09-16、2026-09-28 已結束展覽。 | 不能相信資料集名稱即代表每筆都是北院或仍在展期；逐筆解析文字日期、分院區，未明確標示的先隔離。 |
| [科工館展示廳 JSON](https://websrv.nstm.gov.tw/OtherInfo/OpenData/ExhibitionInfoOpenData.ashx) | HTTP 可讀，共 462 筆：標為特展 372、常設展 58、體驗設施 32。以 2026-10-04 比對結束日，標為特展且尚未結束的有 8 筆。 | 只取 `Category=特展` 並驗證 `YYYYMMDD` 日期；常設展常用 `17530101`、`99991231` 作哨兵值，體驗設施不能混入。部分 `Website` 為空，需確保可回到館方詳情頁。 |
| [海生館特展 JSON](https://www.nmmba.gov.tw/OpenData.aspx?SN=BF6D6EB9CB6876BB) | HTTP 可讀，共 30 筆，其中 26 筆的「app 用開始時間」或「app 用結束時間」至少一欄為空；日期格式混有民國年數字與 ISO 日期。 | 對只有完整可驗證展期的資料建搜尋紀錄；缺日期者先隔離並連回館方頁人工核對，不猜測展期。 |
| [文化部展覽 JSON](https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=6) | HTTP 可讀，本次回傳 300 筆。找到奇美《埃及之王：法老》兩筆，分別為 2026-01-29～12-31、2027-01-01～01-10，兩筆均連向**同一奇美官方特展頁**；也混有奇美常設展。 | 這是文化部彙整來源，不能標為「奇美官方 API」。按官方網址、館所和展名合併相鄰區間，排除常設展；300 筆是否為完整資料、分頁與目標館所覆蓋率仍待查。 |

因此最可行的下個資料來源驗證是**科工館特展 JSON 與故宮 JSON**，但都必須先做欄位過濾與隔離錯誤資料。文化部資料可讓奇美取得一部分機器可讀的第三方紀錄，卻不能取代奇美館方公告；海生館這份資料日期缺漏較多，暫不宜直接整批匯入。
