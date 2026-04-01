#!/bin/bash

# AI 共享狀態查詢 / 更新腳本
# 任務 checkpoint 真相：docs/status/current-work.md
# AI 即時工作狀態：docs/status/ai-activity.json
# docs-site/state.json 由 scripts/sync-state.sh 衍生生成
# 用法：./scripts/ai-state.sh [命令] [參數]

STATE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../docs-site/state.json"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# AI 名稱（從環境變數或預設）
AI_NAME="${AI_NAME:-Codex}"

show_help() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}     AI 共享狀態系統${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""
    echo -e "${CYAN}用法：${NC} ./scripts/ai-state.sh [命令] [參數]"
    echo ""
    echo -e "${YELLOW}注意：${NC} 任務進度請先寫入 docs/status/current-work.md，再執行 bash scripts/sync-state.sh"
    echo ""
    echo -e "${YELLOW}查詢類命令：${NC}"
    echo "  status                 - 查看當前完整狀態"
    echo "  timeline               - 查看最近進度（最近 5 筆）"
    echo "  handover               - 查看當前交接訊息"
    echo "  ai-status              - 查看 AI 團隊狀態"
    echo "  metrics                - 查看程式碼指標"
    echo "  next-step              - 查看下一步建議"
    echo ""
    echo -e "${YELLOW}同步命令：${NC}"
    echo "  sync                   - 由 current-work.md 重建 docs-site/state.json"
    echo ""
    echo -e "${YELLOW}更新命令：${NC}"
    echo "  start [任務描述]       - 更新 AI 即時工作狀態"
    echo "  progress [進度描述]    - 更新 AI 當前進度與 currentTask"
    echo "  done [完成描述]        - 寫入 checkpoint 並同步 docs-site"
    echo "  handover-msg [訊息]    - 留下交接 checkpoint 並同步 docs-site"
    echo "  suggest [建議]         - 寫入建議 checkpoint 並同步 docs-site"
    echo "  blocker [問題]         - 寫入阻礙 checkpoint 並同步 docs-site"
    echo "  idle [狀態描述]        - 只更新 AI 即時狀態為等待中"
    echo ""
    echo -e "${YELLOW}範例：${NC}"
    echo "  ./scripts/ai-state.sh status"
    echo "  AI_NAME=Qwen ./scripts/ai-state.sh start \"整理 knowledge-base\""
    echo "  AI_NAME=Qwen ./scripts/ai-state.sh progress \"正在整理 citations\""
    echo "  AI_NAME=Qwen ./scripts/ai-state.sh done \"完成 knowledge-base 第一批整理\""
    echo "  ./scripts/ai-state.sh next-step"
    echo ""
}

delegate_update() {
    local action="$1"
    shift
    bash "$(dirname "${BASH_SOURCE[0]}")/ai-status.sh" "$action" "$@"
}

# 查詢狀態
query_status() {
    python3 << EOF
import json

with open('$STATE_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("${BLUE}=====================================${NC}")
print("${BLUE}     當前狀態${NC}")
print("${BLUE}=====================================${NC}")
print()
print(f"${CYAN}最後更新：${NC} {data['lastUpdated']}")
print(f"${CYAN}專案：${NC} {data['project']['name']}")
print()
print(f"${YELLOW}📊 指標：${NC}")
print(f"  App.jsx: {data['metrics']['appJsxLines']} 行 ({data['metrics']['appJsxLinesChange']:+d})")
print(f"  測試案例：{data['metrics']['testCases']} 個")
print(f"  完成任務：{data['metrics']['completedTasks']} 個")
print(f"  進行中：{data['metrics']['inProgressTasks']} 個")
print()
print(f"${YELLOW}🚀 Phase 進度：${NC}")
for phase_id, phase in data['phases'].items():
    status_icon = '✅' if phase['status'] == 'completed' else '🔄' if phase['status'] == 'in-progress' else '⏳'
    print(f"  {status_icon} {phase['name']}: {phase['progress']}%")
print()
print(f"${YELLOW}🤖 當前 AI: ${NC} {data['aiTeam']['current']}")
print()
print(f"${YELLOW}📋 交接訊息：${NC}")
print(f"  來自：{data['handover']['from']}")
print(f"  訊息：{data['handover']['message']}")
print(f"  下一步：{data['handover']['nextStep']}")
if data['handover']['optimizationSuggestions']:
    print()
    print(f"${YELLOW}💡 優化建議：${NC}")
    for sug in data['handover']['optimizationSuggestions']:
        print(f"  • {sug}")
print()
print(f"${YELLOW}🏥 健康狀態：${NC} {data['health']['overall']}")
print(f"  Build: {data['health']['build']}")
print(f"  Lint: {data['health']['lint']}")
print(f"  Tests: {data['health']['tests']}")
EOF
}

# 查詢時間軸
query_timeline() {
    python3 << EOF
import json

with open('$STATE_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("${BLUE}=====================================${NC}")
print("${BLUE}     最近進度（最近 5 筆）${NC}")
print("${BLUE}=====================================${NC}")
print()

for i, item in enumerate(data['timeline'][:5]):
    icon = '✅' if item['status'] == 'done' else '🔄'
    print(f"{icon} {item['time']} | {item['ai']}")
    print(f"   {item['title']}")
    print(f"   {item['impact']}")
    if i < 4:
        print()
EOF
}

# 查詢交接訊息
query_handover() {
    python3 << EOF
import json

with open('$STATE_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("${BLUE}=====================================${NC}")
print("${BLUE}     AI 交接筆記${NC}")
print("${BLUE}=====================================${NC}")
print()
print(f"${CYAN}來自：${NC} {data['handover']['from']}")
print(f"${CYAN}時間：${NC} {data['handover']['time']}")
print()
print(f"${YELLOW}📝 訊息：${NC}")
print(f"{data['handover']['message']}")
print()
print(f"${GREEN}➡️ 下一步：${NC}")
print(f"{data['handover']['nextStep']}")
print()
if data['handover']['blockers']:
    print(f"${RED}⚠️ 阻礙：${NC}")
    for blocker in data['handover']['blockers']:
        print(f"  • {blocker}")
    print()
if data['handover']['optimizationSuggestions']:
    print(f"${MAGENTA}💡 優化建議：${NC}")
    for sug in data['handover']['optimizationSuggestions']:
        print(f"  • {sug}")
    print()
EOF
}

# 查詢 AI 團隊狀態
query_ai_status() {
    python3 << EOF
import json

with open('$STATE_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("${BLUE}=====================================${NC}")
print("${BLUE}     AI 團隊狀態${NC}")
print("${BLUE}=====================================${NC}")
print()

current = data['aiTeam']['current']
for member in data['aiTeam']['members']:
    is_current = member['name'] == current
    status_icon = '🟢' if member['status'] == 'working' else '⚪'
    current_marker = ' 👈 當前' if is_current else ''
    
    print(f"{status_icon} {member['avatar']} {member['name']}{current_marker}")
    print(f"    角色：{member['role']}")
    print(f"    狀態：{member['status']}")
    print(f"    當前任務：{member['currentTask']}")
    print(f"    完成任務：{member['tasksCompleted']}")
    print(f"    最後活躍：{member['lastActive']}")
    print()
EOF
}

# 查詢指標
query_metrics() {
    python3 << EOF
import json

with open('$STATE_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("${BLUE}=====================================${NC}")
print("${BLUE}     程式碼指標${NC}")
print("${BLUE}=====================================${NC}")
print()

metrics = data['metrics']
print(f"${CYAN}📄 App.jsx: ${NC} {metrics['appJsxLines']} 行 ({metrics['appJsxLinesChange']:+d})")
print(f"${CYAN}🧪 測試：${NC} {metrics['testCases']} 個案例 / {metrics['testFiles']} 個檔案")
print(f"${CYAN}📚 文檔：${NC} {metrics['totalDocs']} 個")
print(f"${CYAN}✅ 完成：${NC} {metrics['completedTasks']} 個任務")
print(f"${CYAN}🔄 進行中：${NC} {metrics['inProgressTasks']} 個任務")
print()

health = data['health']
print(f"${YELLOW}🏥 健康狀態：${NC} {health['overall']}")
print(f"  Build: {health['build']}")
print(f"  Lint: {health['lint']}")
print(f"  Tests: {health['tests']}")
EOF
}

# 查詢下一步
query_next_step() {
    python3 << EOF
import json

with open('$STATE_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("${BLUE}=====================================${NC}")
print("${BLUE}     下一步建議${NC}")
print("${BLUE}=====================================${NC}")
print()

print(f"${GREEN}➡️ 下一步：${NC}")
print(f"{data['handover']['nextStep']}")
print()

print(f"${CYAN}📊 Phase 進度：${NC}")
for phase_id, phase in data['phases'].items():
    if phase['status'] == 'in-progress':
        print(f"  {phase['name']}: {phase['progress']}%")
        if 'tasks' in phase:
            for task in phase['tasks']:
                if task['status'] == 'doing':
                    print(f"    🔄 {task['name']}")
print()

print(f"${YELLOW}📋 交接訊息：${NC}")
print(f"來自 {data['handover']['from']}: {data['handover']['message']}")
EOF
}

# 更新函數
update_json() {
    python3 << EOF
import json
from datetime import datetime

with open('$STATE_FILE', 'r', encoding='utf-8') as f:
    data = json.load(f)

$1

with open('$STATE_FILE', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
EOF
}

# 開始任務
cmd_start() {
    TASK="$*"
    if [ -z "$TASK" ]; then
        echo -e "${RED}錯誤：請提供任務描述${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}     開始任務${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo "AI: $AI_NAME"
    echo "任務：$TASK"
    echo ""
    
    update_json "
data['aiHandover']['currentTask'] = '$TASK'
data['aiHandover']['lastUpdate'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
data['lastUpdated'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')

# Update AI status
for member in data['aiTeam']['members']:
    if member['name'] == '$AI_NAME':
        member['status'] = 'working'
        member['currentTask'] = '$TASK'
        member['lastActive'] = datetime.now().strftime('%H:%M')
        
# Set current AI
data['aiTeam']['current'] = '$AI_NAME'
"
    echo -e "${GREEN}✅ 任務已更新${NC}"
    echo ""
    echo "查看狀態：./scripts/ai-state.sh status"
}

# 完成任務
cmd_done() {
    COMPLETION="$*"
    if [ -z "$COMPLETION" ]; then
        echo -e "${RED}錯誤：請提供完成描述${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}     完成任務${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo "AI: $AI_NAME"
    echo "完成：$COMPLETION"
    echo ""
    
    TIMESTAMP=$(date +"%H:%M")
    
    update_json "
# Add to timeline
new_item = {
    'time': '$TIMESTAMP',
    'ai': '$AI_NAME',
    'title': '$COMPLETION',
    'description': '由 AI 自動更新',
    'impact': '待更新',
    'status': 'done'
}
data['timeline'].insert(0, new_item)
data['timeline'] = data['timeline'][:10]

# Update metrics
data['metrics']['completedTasks'] += 1
data['lastUpdated'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')

# Update handover
data['handover']['from'] = '$AI_NAME'
data['handover']['message'] = '$COMPLETION'
data['handover']['time'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')

# Update AI status
for member in data['aiTeam']['members']:
    if member['name'] == '$AI_NAME':
        member['status'] = 'idle'
        member['currentTask'] = '等待分配新任務'
        member['tasksCompleted'] += 1
        member['lastActive'] = '$TIMESTAMP'
"
    echo -e "${GREEN}✅ 完成記錄已添加${NC}"
    echo ""
    echo "查看時間軸：./scripts/ai-state.sh timeline"
}

# 交接
cmd_handover() {
    MESSAGE="$*"
    if [ -z "$MESSAGE" ]; then
        echo -e "${RED}錯誤：請提供交接訊息${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}     AI 交接${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo "AI: $AI_NAME"
    echo "訊息：$MESSAGE"
    echo ""
    
    update_json "
data['handover']['from'] = '$AI_NAME'
data['handover']['message'] = '$MESSAGE'
data['handover']['time'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
data['lastUpdated'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
data['aiHandover']['lastAi'] = '$AI_NAME'
"
    echo -e "${GREEN}✅ 交接訊息已更新${NC}"
    echo ""
    echo "查看交接：./scripts/ai-state.sh handover"
}

# 建議
cmd_suggest() {
    SUGGESTION="$*"
    if [ -z "$SUGGESTION" ]; then
        echo -e "${RED}錯誤：請提供優化建議${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}     優化建議${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo "AI: $AI_NAME"
    echo "建議：$SUGGESTION"
    echo ""
    
    update_json "
if '$SUGGESTION' not in data['handover']['optimizationSuggestions']:
    data['handover']['optimizationSuggestions'].append('$SUGGESTION')
data['lastUpdated'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
"
    echo -e "${GREEN}✅ 建議已添加${NC}"
    echo ""
}

# 阻礙
cmd_blocker() {
    BLOCKER="$*"
    if [ -z "$BLOCKER" ]; then
        echo -e "${RED}錯誤：請提供阻礙問題${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}     阻礙問題${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo "AI: $AI_NAME"
    echo "問題：$BLOCKER"
    echo ""
    
    update_json "
if '$BLOCKER' not in data['handover']['blockers']:
    data['handover']['blockers'].append('$BLOCKER')
data['lastUpdated'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
"
    echo -e "${GREEN}✅ 阻礙已記錄${NC}"
    echo ""
}

# 同步
cmd_sync() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}     同步程式碼狀態${NC}"
    echo -e "${BLUE}=====================================${NC}"
    bash "$(dirname "${BASH_SOURCE[0]}")/sync-state.sh"
}

# 主程式
if [ $# -lt 1 ]; then
    show_help
    exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
    status)
        query_status
        ;;
    timeline)
        query_timeline
        ;;
    handover)
        query_handover
        ;;
    ai-status)
        query_ai_status
        ;;
    metrics)
        query_metrics
        ;;
    next-step)
        query_next_step
        ;;
    start)
        delegate_update start "$*"
        ;;
    progress)
        delegate_update progress "$*"
        ;;
    done)
        delegate_update done "$*"
        ;;
    handover-msg)
        delegate_update handover "$*"
        ;;
    suggest)
        delegate_update suggest "$*"
        ;;
    blocker)
        delegate_update blocker "$*"
        ;;
    idle)
        delegate_update idle "$*"
        ;;
    sync)
        cmd_sync
        ;;
    *)
        echo -e "${RED}未知命令：$COMMAND${NC}"
        show_help
        exit 1
        ;;
esac
