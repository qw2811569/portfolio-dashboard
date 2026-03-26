# Checkpoints

這個資料夾用來存放「可被 Git 追蹤的 app 狀態快照」。

用途：
- 在某一頁或某一段功能穩定時，留一份可回頭比對的狀態
- 避免 `data/` 被 `.gitignore` 忽略後，沒有任何歷史可追
- 當持倉、市值、事件或策略大腦又出現異常時，能快速對照最近穩定版本

建立 checkpoint：

```bash
cd /Users/chenkuichen/APP/test
npm run checkpoint -- "holdings-stable"
```

這會把目前可用的狀態 JSON 複製到：

```text
checkpoints/YYYYMMDD-HHMMSS-your-message/
```

如果你要把目前程式碼與 checkpoint 一起送上 GitHub：

```bash
cd /Users/chenkuichen/APP/test
bash scripts/git-checkpoint.sh "holdings-stable" --push
```

注意：
- 這裡只存 server-side / 落地 JSON 狀態
- **不包含** 瀏覽器 `localStorage`
- 所以如果你要保住完整本機 portfolio 狀態，還是要定期用 app 內建 `備份` 匯出 JSON
