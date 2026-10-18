# 2026-10-18｜Neon 正式資料備份與本機隔離還原

## 已驗證結果

- Neon 正式庫回報 PostgreSQL **18.6**。下載 [EDB 官方下載點](https://www.enterprisedb.com/download-postgresql-binaries)提供的 18.6-5 Windows 可攜版，只保留執行所需的用戶端與本機演練工具；ZIP SHA-256 `E2246BA91D22345BC3D017586C09EDE52D9DF180B1EEB480F050445F1CAD84E2` 與 [Chocolatey psql18 18.6.5 套件公布值](https://community.chocolatey.org/packages/psql18/18.6.5)相符。這是第三方套件的校驗值，**不是 EDB 發布的官方校驗值**。
- `pg_dump` 從 Neon 建立 146,102 bytes 的 custom-format 備份，SHA-256 `8074b679838dc3ad83eb797db2540e9ad4403d2e4ddcddd366af67cbcf532222`。備份只在這台電腦的 `%LOCALAPPDATA%\EventRadar\backups`，沒有進 Git、GitHub Actions artifact 或 OneDrive 專案資料夾；密碼從 Git 忽略的既有環境檔讀取，沒有寫入命令列。
- 在只監聽 `127.0.0.1:15437` 的臨時 PostgreSQL 18.6 叢集建立空白 `event_radar_restore_20261018`，執行現有 `restore-check`。還原後有 25 份 migration、11 間館、30 筆展覽、18 筆匯入紀錄，與 Neon 當下唯讀查詢筆數完全相符。臨時叢集已停止並刪除；備份檔仍保留。

## 本機再次備份

PowerShell 在 Event Radar 專案根目錄執行；先確認 Git 忽略的 `private/deployment-credentials.env` 仍是正確的 Neon 直接連線，**不要把連線字串貼進命令、對話或截圖**：

```powershell
$env:EVENT_RADAR_BACKUP_DIR = Join-Path $env:LOCALAPPDATA 'EventRadar\backups'
$env:PG_DUMP_BIN = Join-Path $env:LOCALAPPDATA 'EventRadar\pgsql18\bin\pg_dump.exe'
$env:PG_RESTORE_BIN = Join-Path $env:LOCALAPPDATA 'EventRadar\pgsql18\bin\pg_restore.exe'
npm run backup:db
```

每次會產生新檔。要重新驗證，先建立另一個**空白且獨立**的 `event_radar_restore_*` 資料庫並設定 `RESTORE_DATABASE_URL`，再執行 `npm run restore:check -- <備份檔完整路徑>`；工具會拒絕非空白或名稱不符的目標。演練完須停止並清除臨時庫，再核對正式庫沒有被寫入。

## 遇到的問題與處理

1. 第一版下載的 17.11 `pg_dump` 不能備份 18.6 伺服器；查出伺服器版本後改用相同主版本 18.6。原版工具未產出可用備份檔。
2. `initdb` 從含中文字的 OneDrive 專案路徑執行時，Windows 的繁體中文編碼讓 UTF-8 初始化失敗；即使指定 `--locale=C` 仍失敗。將工具複製到只有英文字元的 `%LOCALAPPDATA%\EventRadar\pgsql18` 後成功。這與 [PostgreSQL 官方郵件列表紀錄的 Windows 非 ASCII 路徑問題](https://www.postgresql.org/message-id/16926-e4ef345545d185ab%40postgresql.org)相符，但未進一步證明底層錯誤完全相同。
3. 第一個本機測試埠 `55437` 無法綁定；改用未佔用的 `15437` 後只在 `127.0.0.1` 啟動成功。沒有為了測試開放外部網路介面。

## 邊界

這次證明**當次快照可在隔離庫還原並讀出主要資料**，不代表之後的備份都會成功。這份備份尚未加密，也沒有異地副本、定期輪替或對所有資料表做逐欄比對；若這台電腦故障，單一備份可能一併遺失。下一次正式 migration 前要重新備份並再次核對。正式環境若需要復原，應先停止寫入、建立新的隔離目標並評估回退，不能直接對 Neon 原庫執行測試還原命令。
