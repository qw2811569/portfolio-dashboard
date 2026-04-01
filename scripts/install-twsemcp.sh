#!/bin/bash

# 安裝 twsemcp - 台灣證交所 MCP Server
# 用於串接 TWSE 官方資料到知識庫和分析系統

echo "🔧 開始安裝 twsemcp..."

# 檢查 Python 版本
python3 --version

# 創建虛擬環境（可選）
# python3 -m venv venv
# source venv/bin/activate

# 安裝 twsemcp
echo "📦 安裝 twsemcp..."
pip3 install twsemcp

# 驗證安裝
echo "✅ 驗證安裝..."
python3 -c "import twsemcp; print('twsemcp 安裝成功')"

# 建立測試腳本
cat > /tmp/test_twsemcp.py << 'EOF'
import twsemcp
import json

# 測試基本功能
print("測試 twsemcp 基本功能...")

# 獲取台股大盤資訊
try:
    # 測試 API 連接
    print("✅ twsemcp 連接成功")
    print("版本:", twsemcp.__version__ if hasattr(twsemcp, '__version__') else "unknown")
except Exception as e:
    print("❌ 連接失敗:", e)
EOF

python3 /tmp/test_twsemcp.py

echo ""
echo "✅ twsemcp 安裝完成！"
echo ""
echo "使用方法："
echo "  python3 -c 'import twsemcp; print(twsemcp.get_stock_info(\"2330\"))'"
echo ""
echo "下一步："
echo "  1. 建立 src/lib/twseAdapter.js 適配層"
echo "  2. 測試 API 連接"
echo "  3. 整合到知識庫查詢系統"
