#!/usr/bin/env python3
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import uuid


ROOT = Path(__file__).resolve().parents[1]
STORAGE_DIR = ROOT / ".anythingllm-storage"
API_BASE = os.environ.get("ANYTHINGLLM_API_BASE", "http://127.0.0.1:3001/api")
API_KEY_PATH = STORAGE_DIR / "local-api-key.txt"


WORKSPACES = [
    {
        "name": "台股策略總庫",
        "prompt": (
            "你是台灣股市策略研究知識庫。你的工作是整理、比較、篩選並回顧台股策略資料，"
            "特別關注產業趨勢、法說/財報/月營收節奏、消息與族群連動、籌碼面與技術分析。"
            "回答時要區分已知事實、推論、待驗證事項，不要把不確定資料講成定論。"
        ),
    },
    {
        "name": "產業與消息連動",
        "prompt": (
            "你是台股產業趨勢與消息連動研究庫。重點整理供應鏈、族群輪動、法說、財報、月營收、"
            "政策消息與股價反應之間的關係。遇到缺資料要明講。"
        ),
    },
    {
        "name": "籌碼與技術分析",
        "prompt": (
            "你是台股籌碼與技術分析研究庫。重點整理成交量、均線、型態、支撐壓力、法人與主力籌碼、"
            "融資融券與市場節奏，並把技術訊號放回台股情境解讀。"
        ),
    },
]


SEED_DOCS = {
    "台股策略總庫": [
        {
            "title": "台股策略研究任務書",
            "text": """
台股策略研究任務書

目標：
1. 建立可長期檢索的台股策略知識庫。
2. 從既有文件中篩選出高價值、可重複驗證的策略與研究框架。
3. 研究重點包含：
   - 產業趨勢與供應鏈位置
   - 消息、法說、財報、月營收對股價的連動
   - 籌碼面與技術分析
   - 題材輪動與市場節奏

回答規則：
1. 先區分：已知事實 / 推論 / 待驗證事項。
2. 若資料過期或不足，要明說。
3. 優先整理台灣股市特有節奏：月營收、法說、財報、族群輪動、處置/分盤、零股。
4. 不把單一案例誤當通則。
5. 對策略結論要指出適用情境、失效條件與風險。
""".strip(),
            "pin": True,
        },
    ],
    "產業與消息連動": [
        {
            "title": "產業趨勢與消息連動研究框架",
            "text": """
產業趨勢與消息連動研究框架

研究時請優先整理：
1. 供應鏈位置：公司位於 IC 設計、晶圓代工、封測、設備、材料、AI 伺服器、PCB/CCL、被動元件或其他鏈條哪一段。
2. 催化劑分類：法說、財報、月營收、政策、報價、缺貨、擴產、新客戶、AI 題材、報價循環。
3. 連動節奏：消息出現後，先反應的是哪一類股票，第二波傳導到哪裡，何時容易鈍化。
4. 驗證訊號：月營收增速、毛利率拐點、法人調升目標價、法說口徑變化、量價結構。
5. 失效條件：題材鈍化、財報不如預期、族群資金轉移、估值過高、供應鏈價格反轉。

輸出時請整理：
- 產業主軸
- 受惠鏈條
- 領頭股 / 跟漲股 / 落後補漲股
- 需要追蹤的下一個事件窗口
""".strip(),
            "pin": True,
        },
    ],
    "籌碼與技術分析": [
        {
            "title": "籌碼與技術分析研究框架",
            "text": """
籌碼與技術分析研究框架

請用台股語境解讀技術與籌碼，不要只套用通用教科書。

重點：
1. 量價結構：突破、假突破、爆量長黑、縮量整理、沿均線趨勢。
2. 均線與位置：5/10/20/60/120 日均線、前高前低、箱型區間、缺口。
3. 籌碼面：三大法人連續買賣、主力券商分點、融資融券、借券、零股熱度。
4. 台股節奏：法說前卡位、財報前後反應、月營收公告前後、熱門題材輪動。
5. 失真來源：流動性不足、權證與 ETF 影響、消息面先行、隔日沖、處置股。

回答時請把技術訊號放回：
- 產業位階
- 消息催化
- 財報與月營收新鮮度
- 量價是否有法人支持
""".strip(),
            "pin": True,
        },
    ],
}


FILE_DOCS = {
    "台股策略總庫": [
        ROOT / "docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md",
        ROOT / "docs/superpowers/plans/2026-03-23-multi-portfolio-event-tracking-implementation-plan.md",
        ROOT / "docs/superpowers/specs/2026-03-24-claude-tw-stock-analysis-tooling-guide.md",
        ROOT / "docs/superpowers/specs/2026-03-24-client-report-production-playbook.md",
        ROOT / "docs/superpowers/specs/2026-03-24-holding-dossier-and-refresh-architecture.md",
        ROOT / "docs/superpowers/specs/2026-03-25-qwen-anythingllm-setup-and-division.md",
        ROOT / "docs/superpowers/plans/2026-03-25-strategy-brain-v2-llm-routing-plan.md",
        ROOT / "docs/evals/program.md",
        ROOT / "docs/superpowers/specs/2026-03-26-anythingllm-tw-stock-prompt-templates.md",
    ],
    "產業與消息連動": [
        ROOT / "docs/superpowers/specs/2026-03-23-multi-portfolio-event-tracking-design.md",
        ROOT / "docs/superpowers/specs/2026-03-24-claude-tw-stock-analysis-tooling-guide.md",
        ROOT / "data/jinliancheng-desmond-client-report.html",
    ],
    "籌碼與技術分析": [
        ROOT / "docs/superpowers/specs/2026-03-26-anythingllm-tw-stock-prompt-templates.md",
        ROOT / "data/jinliancheng-report.html",
        ROOT / "data/jinliancheng-desmond-client-report.html",
    ],
}


PDF_DOCS = {
    "台股策略總庫": [
        Path("/Users/chenkuichen/Downloads/Desmond客戶持股健檢.pdf"),
        Path("/Users/chenkuichen/金聯成持倉.pdf"),
    ],
    "產業與消息連動": [
        Path("/Users/chenkuichen/Downloads/Desmond客戶持股健檢.pdf"),
    ],
}


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: List[str] = []

    def handle_data(self, data: str) -> None:
        cleaned = data.strip()
        if cleaned:
            self.parts.append(cleaned)

    def text(self) -> str:
        return "\n".join(self.parts)


def read_api_key() -> str:
    key = API_KEY_PATH.read_text(encoding="utf-8").strip()
    if not key:
        raise RuntimeError("AnythingLLM API key is empty")
    return key


def api_request(method: str, path: str, payload: Dict = None) -> Dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        f"{API_BASE}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {read_api_key()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"{method} {path} failed: {exc.code} {details}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {path} failed: {exc.reason}") from exc


def multipart_request(path: str, fields: Dict[str, str], file_field: str, file_path: Path) -> Dict:
    boundary = f"----AnythingLLM{uuid.uuid4().hex}"
    chunks: List[bytes] = []
    for key, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )

    mime = "application/pdf" if file_path.suffix.lower() == ".pdf" else "application/octet-stream"
    chunks.extend(
        [
            f"--{boundary}\r\n".encode(),
            (
                f'Content-Disposition: form-data; name="{file_field}"; filename="{file_path.name}"\r\n'
                f"Content-Type: {mime}\r\n\r\n"
            ).encode(),
            file_path.read_bytes(),
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    body = b"".join(chunks)
    request = Request(
        f"{API_BASE}{path}",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {read_api_key()}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"POST {path} failed: {exc.code} {details}") from exc
    except URLError as exc:
        raise RuntimeError(f"POST {path} failed: {exc.reason}") from exc


def to_text(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if path.suffix.lower() == ".html":
        parser = TextExtractor()
        parser.feed(raw)
        return parser.text()
    return raw


def slugify_title(title: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", title).strip("-")
    return slug or "document"


def ensure_workspace(name: str, prompt: str) -> Dict:
    workspaces = api_request("GET", "/v1/workspaces").get("workspaces", [])
    for workspace in workspaces:
        if workspace["name"] == name:
            api_request(
                "POST",
                f"/v1/workspace/{workspace['slug']}/update",
                {
                    "openAiPrompt": prompt,
                    "chatMode": "query",
                    "topN": 6,
                    "openAiTemp": 0.2,
                    "openAiHistory": 20,
                    "similarityThreshold": 0.7,
                },
            )
            return workspace
    return api_request(
        "POST",
        "/v1/workspace/new",
        {
            "name": name,
            "similarityThreshold": 0.7,
            "openAiTemp": 0.2,
            "openAiHistory": 20,
            "openAiPrompt": prompt,
            "chatMode": "query",
            "topN": 6,
        },
    )["workspace"]


def existing_titles(slug: str) -> set:
    payload = api_request("GET", f"/v1/workspace/{slug}").get("workspace", {})
    if isinstance(payload, list):
        workspace = payload[0] if payload else {}
    else:
        workspace = payload or {}
    docs = workspace.get("documents", []) or []
    return {doc.get("title") or doc.get("filename") for doc in docs}


def upload_raw_text(slug: str, title: str, text: str, pin: bool = False, doc_source: str = None) -> Dict:
    resolved_title = title if "." in title else f"{title}.txt"
    response = api_request(
        "POST",
        "/v1/document/raw-text",
        {
            "textContent": text,
            "addToWorkspaces": slug,
            "metadata": {
                "title": resolved_title,
                "docSource": doc_source or "Local AnythingLLM seed ingestion",
                "description": f"Seeded into workspace {slug} from local repo",
                "sourceId": slugify_title(title),
            },
        },
    )
    document = (response.get("documents") or [None])[0]
    if pin and document:
        api_request(
            "POST",
            f"/v1/workspace/{slug}/update-pin",
            {"docPath": document["location"], "pinStatus": True},
        )
    return document or {}


def upload_file(slug: str, file_path: Path, pin: bool = False) -> Dict:
    response = multipart_request(
        "/v1/document/upload",
        {"addToWorkspaces": slug},
        "file",
        file_path,
    )
    document = (response.get("documents") or [None])[0]
    if pin and document:
        api_request(
            "POST",
            f"/v1/workspace/{slug}/update-pin",
            {"docPath": document["location"], "pinStatus": True},
        )
    return document or {}


def main() -> int:
    report = {"api_base": API_BASE, "workspaces": []}
    for spec in WORKSPACES:
        workspace = ensure_workspace(spec["name"], spec["prompt"])
        titles = existing_titles(workspace["slug"])
        uploaded = []

        for seed in SEED_DOCS.get(spec["name"], []):
            if seed["title"] in titles:
                continue
            doc = upload_raw_text(
                workspace["slug"],
                seed["title"],
                seed["text"],
                pin=seed.get("pin", False),
                doc_source="Strategy seed note",
            )
            uploaded.append({"title": seed["title"], "location": doc.get("location"), "type": "seed"})

        for path in FILE_DOCS.get(spec["name"], []):
            title = path.name
            if title in titles:
                continue
            text = to_text(path)
            if not text.strip():
                continue
            doc = upload_raw_text(
                workspace["slug"],
                title,
                text,
                pin=path.suffix.lower() in {".md", ".txt"},
                doc_source=str(path.relative_to(ROOT)),
            )
            uploaded.append({"title": title, "location": doc.get("location"), "type": "file"})

        for pdf_path in PDF_DOCS.get(spec["name"], []):
            if not pdf_path.exists():
                continue
            title = pdf_path.name
            if title in titles:
                continue
            doc = upload_file(workspace["slug"], pdf_path)
            uploaded.append({"title": title, "location": doc.get("location"), "type": "pdf"})

        report["workspaces"].append(
            {
                "name": workspace["name"],
                "slug": workspace["slug"],
                "uploaded": uploaded,
                "uploaded_count": len(uploaded),
            }
        )

    report_path = STORAGE_DIR / "ingest-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nReport written to {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
