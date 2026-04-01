#!/usr/bin/env python3
"""
TWSE 個股資訊獲取
用法：python3 twsemcp_get_stock.py 2330
"""

import sys
import json

try:
    from twse import TWSE
except ImportError:
    print(json.dumps({"error": "twse module not installed"}))
    sys.exit(1)

def get_stock_info(stock_id):
    """獲取個股基本資訊"""
    try:
        twse = TWSE()
        # 獲取基本資料
        company = twse.company(stock_id)
        
        result = {
            "stockId": stock_id,
            "name": company.get("name", "") if company else "",
            "sector": company.get("industry", "") if company else "",
            "market": "TWSE" if stock_id.startswith(("1", "2", "3", "4", "5", "6")) else "TPEX",
            "success": True
        }
        
        return result
    except Exception as e:
        return {
            "stockId": stock_id,
            "error": str(e),
            "success": False
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "請提供股票代碼"}))
        sys.exit(1)
    
    stock_id = sys.argv[1]
    result = get_stock_info(stock_id)
    print(json.dumps(result, ensure_ascii=False))
