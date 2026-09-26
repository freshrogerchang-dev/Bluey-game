# S4 Build Log

## 啟動方式

`npm start`，無環境變數、無後端、無資料庫。

## Backlog

- iPad Safari 實機操作與加入主畫面驗證。
- 家長區與遊玩時間設定。
- 若要公開發布，替換全部受版權保護的角色素材。

## 2026-09-26 垂直切片 1：四個生活任務

- 建立首頁、四關共 16 個情境步驟、溫和回饋、任務完成紀錄。
- 加入繁中 SpeechSynthesis、聲音開關、鍵盤焦點樣式、減少動態偏好。
- 加入 manifest、service worker 與本機快取。
- 加入純邏輯自動測試，涵蓋題目結構、單一正解、步驟界線與完成去重。
- 驗證：`npm test` 4/4 通過；桌面瀏覽器實際走完洗碗關卡，包含答錯、重試、四步推進與完成紀錄；console error/warning 為 0。

## 2026-09-26 GitHub Pages 部署

- repository：`freshrogerchang-dev/Bluey-game`。
- GitHub Pages 直接從 `main` 分支根目錄發布；推送前在本機執行測試。
- 預定網址：`https://freshrogerchang-dev.github.io/Bluey-game/`。
- 部署驗證：HTTP 200，頁面標題為「布麗的生活任務」。
