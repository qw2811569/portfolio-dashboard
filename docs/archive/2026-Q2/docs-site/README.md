# 文檔網站使用指南

> **2026-04-28 更新（per Codex R32 R2 critique）**：state 來源已改成 `bash scripts/sync-state.sh` 衍生輸出（`docs/status/current-work.md` + `docs/status/ai-activity.json` + `ai-activity-log.json`）。**不要再手動 edit `index.html` 的 phase progress / timeline / documents object** — 那些 section 由 `scripts/build-docs-state.mjs` 重建，手動改會被下次 sync 蓋掉。詳見 [`DYNAMIC_GUIDE.md`](./DYNAMIC_GUIDE.md)。

## 🚀 快速啟動

### 方法 1：VSCode Task（推薦）

1. 在 VSCode 中按 `Cmd+Shift+P`
2. 輸入 `Tasks: Run Task`
3. 選擇 `📄 Docs Site: Launch`
4. 開啟瀏覽器到 http://localhost:8080

### 方法 2：終端機啟動

```bash
bash scripts/launch-docs-site.sh
```

然後開啟瀏覽器到 http://localhost:8080

---

## 📱 網站功能

### 儀表板（首頁）

- **狀態卡片**：總文檔數、已完成任務、進行中任務、最後更新時間
- **整體進度**：Phase A/B/C 完成度條
- **最近進度**：時間軸顯示最新開發進度

### 所有文檔

- **搜尋功能**：可直接搜尋文檔標題與描述
- **分類瀏覽**：
  - 🔵 核心文檔（AI 協作指南、系統架構、使用者指南等）
  - 🟢 策略文檔（選股策略、付費/停損討論、競品分析等）
  - 🟡 技術文檔（設計規格書）
  - 🔴 指南文檔（快速開始、伺服器訪問指南）

### 進度追蹤

- **Phase 完成度**：視覺化進度條
- **完整時間軸**：所有開發記錄，包含：
  - ✅ 已完成（綠色標記）
  - 🟡 進行中（黃色標記，有脈衝動畫）
  - ⚪ 下一步（灰色標記）

### 問題排查

快速找到常見問題解決方案：

- ⚪ 白頁 / 無法啟動
- ⚡ Fast Refresh 問題
- 🧪 測試失敗
- 📝 Lint / Typecheck 錯誤
- 🤖 策略大腦 / AI 問題
- 🔴 Runtime 錯誤

---

## 🎨 視覺設計

- **漸層背景**：紫色漸層（#667eea → #764ba2）
- **玻璃擬態**：側邊欄與卡片使用毛玻璃效果
- **響應式設計**：自動適應不同螢幕尺寸
- **動畫效果**：
  - 卡片懸停上浮
  - 進行中任務脈衝動畫
  - 進度條平滑過渡

---

## 📁 檔案結構

```
docs-site/
└── index.html          # 主網站（單一檔案，包含所有 CSS/JS）

scripts/
└── launch-docs-site.sh # 啟動腳本
```

---

## 🔧 自訂內容

### 更新進度數據

編輯 `index.html` 中的以下部分：

```javascript
// 更新狀態卡片數字
document.getElementById('total-docs').textContent = '22'
document.getElementById('completed-tasks').textContent = '18'
document.getElementById('in-progress-tasks').textContent = '4'

// 更新進度條
document.getElementById('phase-a-progress').textContent = '100%'
document.getElementById('phase-b-progress').textContent = '60%'
document.getElementById('phase-c-progress').textContent = '30%'
```

### 新增時間軸項目

在 `index.html` 的 timeline 區塊新增：

```html
<div class="timeline-item completed">
  <div class="timeline-date">2026-03-29 19:58</div>
  <div class="timeline-title">你的標題</div>
  <div class="timeline-desc">你的描述</div>
</div>
```

### 新增文檔卡片

在 `documents` JavaScript 物件新增：

```javascript
'your-doc-id': {
    title: '📄 文檔標題',
    content: `
        <h3>這是什麼？</h3>
        <p>描述內容</p>
        <h3>主要內容</h3>
        <ul>
            <li>項目 1</li>
        </ul>
    `
}
```

---

## 💡 使用技巧

1. **快速搜尋**：在「所有文檔」頁面使用搜尋框，輸入關鍵字即時過濾
2. **查看進度**：儀表板顯示整體進度，進度追蹤頁面顯示詳細時間軸
3. **問題排查**：遇到問題時，直接到「問題排查」頁面找對應解決方案
4. **文檔預覽**：點擊任何文檔卡片會彈出預覽視窗，無需離開當前頁面

---

## 🛑 停止伺服器

在終端機按 `Ctrl+C`
