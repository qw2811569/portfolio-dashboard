#!/usr/bin/env python3
"""
sync-coverage-data.py

從 My-TW-Coverage repo 解析 Pilot_Reports markdown，
產出 src/data/ 下的靜態 JSON 檔案。

使用方式：
  python scripts/sync-coverage-data.py --source /path/to/My-TW-Coverage
  python scripts/sync-coverage-data.py --source /path/to/My-TW-Coverage --tickers 2330,2317,3017
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_wikilinks(text: str) -> str:
    """Replace [[text]] with text."""
    return re.sub(r'\[\[([^\]]+)\]\]', r'\1', text)


def _extract_wikilinks(text: str) -> list:
    """Return all unique [[target]] values found in text."""
    return list(dict.fromkeys(re.findall(r'\[\[([^\]]+)\]\]', text)))


def _extract_field(text: str, field: str) -> str:
    """
    Extract value from a bold markdown field, e.g.
      **板塊:** Technology  ->  "Technology"
    """
    pattern = rf'\*\*{re.escape(field)}[：:]\*\*\s*(.+)'
    m = re.search(pattern, text)
    return m.group(1).strip() if m else ''


def _section_lines(text: str, heading: str) -> list:
    """
    Return non-empty lines that belong to a section whose heading matches
    `heading` (case-insensitive). Stops at the next same-level or higher
    heading.
    """
    # Find the heading line
    pattern = rf'^#{1,6}\s+{re.escape(heading)}\s*$'
    lines = text.splitlines()
    start = None
    heading_level = None
    for i, line in enumerate(lines):
        if re.match(pattern, line, re.IGNORECASE):
            start = i + 1
            heading_level = len(line) - len(line.lstrip('#'))
            break
    if start is None:
        return []

    result = []
    stop_pattern = re.compile(r'^(#{1,' + str(heading_level) + r'})\s')
    for line in lines[start:]:
        if stop_pattern.match(line):
            break
        stripped = line.strip()
        if stripped:
            result.append(stripped)
    return result


def _names_from_section(text: str, heading: str) -> list:
    """
    Parse names from a section like:
      ## 上游
      - 台積電
      - 聯發科
    or bold entries:
      - **台積電**
    """
    names = []
    for line in _section_lines(text, heading):
        # Strip list marker
        line = re.sub(r'^[-*]\s*', '', line)
        # Strip bold markers
        line = re.sub(r'\*\*([^*]+)\*\*', r'\1', line)
        # Strip wikilinks
        line = _strip_wikilinks(line)
        line = line.strip()
        if line:
            names.append(line)
    return names


def _names_from_subsection(text: str, heading: str) -> list:
    """
    Parse names from a ### subsection like:
      ### 主要客戶
      - Apple
      - NVIDIA
    """
    return _names_from_section(text, heading)


# ---------------------------------------------------------------------------
# parse_report
# ---------------------------------------------------------------------------

def parse_report(filepath: Path) -> dict | None:
    """
    Parse a single company Pilot Report markdown file.

    Returns a dict with keys:
      code, name, sector, industry, description, wikilinks,
      upstream, downstream, customers, suppliers
    or None if the file cannot be parsed.
    """
    try:
        text = filepath.read_text(encoding='utf-8')
    except Exception as e:
        print(f'  [warn] 無法讀取 {filepath}: {e}', file=sys.stderr)
        return None

    # ── title: # 2330 - [[台積電]] or # 2330 台積電 ──────────────────────────
    title_match = re.search(
        r'^#\s+(\d{4,6})\s*[-–]?\s*\[\[([^\]]+)\]\]|^#\s+(\d{4,6})\s+([^\n]+)',
        text,
        re.MULTILINE,
    )
    if not title_match:
        print(f'  [warn] 無法解析標題：{filepath.name}', file=sys.stderr)
        return None

    if title_match.group(1):
        code = title_match.group(1).strip()
        name = title_match.group(2).strip()
    else:
        code = title_match.group(3).strip()
        name = _strip_wikilinks(title_match.group(4)).strip()

    # ── sector / industry ───────────────────────────────────────────────────
    sector = _extract_field(text, '板塊')
    industry = _extract_field(text, '產業')

    # ── description: first paragraph after ## 業務簡介 ──────────────────────
    desc = ''
    biz_lines = _section_lines(text, '業務簡介')
    for line in biz_lines:
        # Skip heading-like or empty lines
        if line.startswith('#'):
            continue
        clean = _strip_wikilinks(line).strip()
        if clean:
            desc = clean[:300]
            break

    # ── wikilinks: all [[...]] in the entire file ────────────────────────────
    wikilinks = _extract_wikilinks(text)

    # ── upstream / downstream names ──────────────────────────────────────────
    upstream_names = _names_from_section(text, '上游')
    downstream_names = _names_from_section(text, '下游')

    # ── customers / suppliers ────────────────────────────────────────────────
    customers = _names_from_subsection(text, '主要客戶')
    suppliers = _names_from_subsection(text, '主要供應商')

    return {
        'code': code,
        'name': name,
        'sector': sector,
        'industry': industry,
        'description': desc,
        'wikilinks': wikilinks,
        'upstream': upstream_names,
        'downstream': downstream_names,
        'customers': customers,
        'suppliers': suppliers,
    }


# ---------------------------------------------------------------------------
# parse_theme
# ---------------------------------------------------------------------------

def parse_theme(filepath: Path) -> dict | None:
    """
    Parse a theme markdown file.

    Returns a dict with keys:
      name, description, count, relatedThemes, stocks
    or None on failure.
    """
    try:
        text = filepath.read_text(encoding='utf-8')
    except Exception as e:
        print(f'  [warn] 無法讀取 {filepath}: {e}', file=sys.stderr)
        return None

    # ── theme name from filename (without extension) ─────────────────────────
    theme_name = filepath.stem

    # ── description from # title (first h1) ─────────────────────────────────
    h1_match = re.search(r'^#\s+(.+)', text, re.MULTILINE)
    description = _strip_wikilinks(h1_match.group(1)).strip() if h1_match else theme_name

    # ── count ────────────────────────────────────────────────────────────────
    count_match = re.search(r'\*\*涵蓋公司數[：:]\*\*\s*(\d+)', text)
    count = int(count_match.group(1)) if count_match else 0

    # ── relatedThemes: [[X]] | [[Y]] ─────────────────────────────────────────
    related_match = re.search(r'\*\*相關主題[：:]\*\*\s*(.+)', text)
    if related_match:
        related_themes = _extract_wikilinks(related_match.group(1))
    else:
        related_themes = []

    # ── stocks by section ────────────────────────────────────────────────────
    # Lines look like:  - **1587 吉茂**  or  - 1587 吉茂
    code_pattern = re.compile(r'(\d{4,6})')

    def _codes_from_section(section_heading: str) -> list:
        codes = []
        for line in _section_lines(text, section_heading):
            line = re.sub(r'^[-*]\s*', '', line)
            line = re.sub(r'\*\*', '', line)
            line = _strip_wikilinks(line)
            m = code_pattern.search(line)
            if m:
                codes.append(m.group(1))
        return codes

    stocks = {
        'upstream': _codes_from_section('上游'),
        'midstream': _codes_from_section('中游'),
        'downstream': _codes_from_section('下游'),
    }

    return {
        'name': theme_name,
        'description': description,
        'count': count,
        'relatedThemes': related_themes,
        'stocks': stocks,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def build_supply_chain(report: dict) -> dict:
    """
    Convert a parsed report into the supplyChain.json entry format.
    Upstream / downstream are simple name lists from the markdown,
    so we produce minimal objects (no code/product/dependency enrichment).
    """
    upstream = [{'name': n, 'code': None, 'product': None, 'dependency': None}
                for n in report['upstream']]
    downstream = [{'name': n, 'code': None, 'product': None, 'revenueShare': None}
                  for n in report['downstream']]
    return {
        'name': report['name'],
        'upstream': upstream,
        'downstream': downstream,
        'customers': report['customers'],
        'suppliers': report['suppliers'],
    }


def main():
    parser = argparse.ArgumentParser(
        description='Sync My-TW-Coverage markdown → src/data JSON files'
    )
    parser.add_argument(
        '--source',
        required=True,
        help='Path to My-TW-Coverage repo root',
    )
    parser.add_argument(
        '--tickers',
        default='',
        help='Comma-separated ticker codes to filter (e.g. 2330,2317)',
    )
    parser.add_argument(
        '--output',
        default='src/data',
        help='Output directory (default: src/data)',
    )
    args = parser.parse_args()

    source = Path(args.source).resolve()
    if not source.is_dir():
        print(f'[error] --source 路徑不存在或不是目錄：{source}', file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    ticker_filter = set()
    if args.tickers:
        ticker_filter = {t.strip() for t in args.tickers.split(',') if t.strip()}

    # ── Parse company reports ────────────────────────────────────────────────
    reports_dir = source / 'Pilot_Reports'
    company_profiles: dict = {}
    supply_chain: dict = {}
    report_count = 0
    skipped_count = 0

    if reports_dir.is_dir():
        md_files = sorted(reports_dir.rglob('*.md'))
        print(f'[info] 找到 {len(md_files)} 個公司報告 markdown 檔案')
        for fp in md_files:
            result = parse_report(fp)
            if result is None:
                skipped_count += 1
                continue
            code = result['code']
            if ticker_filter and code not in ticker_filter:
                continue
            company_profiles[code] = {
                'name': result['name'],
                'sector': result['sector'],
                'industry': result['industry'],
                'description': result['description'],
                'wikilinks': result['wikilinks'],
            }
            supply_chain[code] = build_supply_chain(result)
            report_count += 1
    else:
        print(f'[warn] Pilot_Reports 目錄不存在：{reports_dir}', file=sys.stderr)

    # ── Parse themes ─────────────────────────────────────────────────────────
    themes_dir = source / 'themes'
    themes: dict = {}
    theme_count = 0

    if themes_dir.is_dir():
        theme_files = sorted(themes_dir.glob('*.md'))
        print(f'[info] 找到 {len(theme_files)} 個主題 markdown 檔案')
        for fp in theme_files:
            if fp.name.lower() == 'readme.md':
                continue
            result = parse_theme(fp)
            if result is None:
                continue
            name = result.pop('name')
            themes[name] = result
            theme_count += 1
    else:
        print(f'[warn] themes 目錄不存在：{themes_dir}', file=sys.stderr)

    # ── Write JSON ───────────────────────────────────────────────────────────
    def write_json(filename: str, data: dict):
        path = output_dir / filename
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'[done] 寫入 {path}  ({len(data)} 筆)')

    write_json('companyProfiles.json', company_profiles)
    write_json('supplyChain.json', supply_chain)
    write_json('themes.json', themes)

    print(
        f'\n[summary] 公司報告 {report_count} 筆'
        + (f'（略過 {skipped_count} 筆）' if skipped_count else '')
        + f'，主題 {theme_count} 筆'
    )


if __name__ == '__main__':
    main()
