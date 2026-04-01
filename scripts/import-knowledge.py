#!/usr/bin/env python3
"""
知識庫導入腳本
從現有文檔提取知識到 knowledge-base
"""

import json
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]  # scripts 目錄
DOCS_DIR = ROOT.parent / 'docs'
KNOWLEDGE_DIR = ROOT.parent / 'src' / 'lib' / 'knowledge-base'

def load_knowledge_file(filename):
    """載入知識庫文件"""
    path = KNOWLEDGE_DIR / filename
    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def save_knowledge_file(filename, data):
    """儲存知識庫文件"""
    path = KNOWLEDGE_DIR / filename
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def extract_from_file(filepath, category):
    """從 Markdown 文件提取知識"""
    items = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 簡單的提取邏輯（可以根據實際需求擴展）
    # 尋找標題和內容塊
    lines = content.split('\n')
    current_title = None
    current_content = []
    
    for line in lines:
        if line.startswith('### ') or line.startswith('## '):
            if current_title and current_content:
                items.append({
                    'id': f"{category}-{len(items)+1:03d}",
                    'title': current_title.strip('# ').strip(),
                    'content': '\n'.join(current_content).strip(),
                    'tags': [category],
                    'source': filepath.name,
                    'createdAt': datetime.now().strftime('%Y-%m-%d')
                })
            current_title = line
            current_content = []
        elif current_title:
            current_content.append(line)
    
    # 最後一個項目
    if current_title and current_content:
        items.append({
            'id': f"{category}-{len(items)+1:03d}",
            'title': current_title.strip('# ').strip(),
            'content': '\n'.join(current_content).strip(),
            'tags': [category],
            'source': filepath.name,
            'createdAt': datetime.now().strftime('%Y-%m-%d')
        })
    
    return items

def main():
    print("🔍 開始知識庫導入...")
    
    # 定義要掃描的文件和對應分類
    files_to_scan = [
        ('MY_TW_COVERAGE_ANALYSIS.md', 'industry-trends'),
        ('THREE_KEY_POINTS_DISCUSSION.md', 'chip-analysis'),
        ('stock-selection-strategy.md', 'technical-analysis'),
    ]
    
    total_imported = 0
    
    for filename, category in files_to_scan:
        filepath = DOCS_DIR / filename
        if not filepath.exists():
            print(f"⚠️  找不到文件：{filename}")
            continue
        
        print(f"📄 掃描：{filename} → {category}")
        
        # 提取知識
        items = extract_from_file(filepath, category)
        
        if not items:
            print(f"  ⚠️  未提取到知識")
            continue
        
        # 載入目標知識庫
        kb_file = f"{category}.json"
        kb_data = load_knowledge_file(kb_file)
        
        if not kb_data:
            print(f"  ⚠️  知識庫文件不存在：{kb_file}")
            continue
        
        # 添加知識（避免重複）
        existing_ids = {item['id'] for item in kb_data['items']}
        new_items = [item for item in items if item['id'] not in existing_ids]
        
        kb_data['items'].extend(new_items)
        kb_data['metadata']['itemCount'] = len(kb_data['items'])
        kb_data['metadata']['lastUpdated'] = datetime.now().isoformat()
        
        # 儲存
        save_knowledge_file(kb_file, kb_data)
        
        print(f"  ✅ 導入 {len(new_items)} 條知識")
        total_imported += len(new_items)
    
    print(f"\n✅ 完成！共導入 {total_imported} 條知識")
    
    # 更新索引
    index = load_knowledge_file('index.json')
    if index:
        index['metadata']['totalItems'] = total_imported
        index['metadata']['lastUpdated'] = datetime.now().isoformat()
        save_knowledge_file('index.json', index)

if __name__ == '__main__':
    main()
