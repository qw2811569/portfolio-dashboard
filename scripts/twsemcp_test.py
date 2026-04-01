#!/usr/bin/env python3
"""
TWSE 連接測試
"""

import json

try:
    from twse import get_stock_info
    
    # 測試獲取台積電資訊
    result = get_stock_info("2330")
    
    print(json.dumps({
        "success": result is not None,
        "message": "TWSE 連接成功" if result else "TWSE 連接失敗但模組可用",
        "module": "twse",
        "test_stock": "2330",
        "has_data": bool(result)
    }))
except Exception as e:
    print(json.dumps({
        "success": False,
        "message": str(e)
    }))
