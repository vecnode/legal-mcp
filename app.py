import io
import os
from typing import List, Optional, Tuple
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader

load_dotenv()

app = FastAPI(title="legal-mcp", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


def _ollama_base() -> str:
    return os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")


def _ollama_model() -> str:
    return os.getenv("OLLAMA_MODEL", "glm-4.7-flash:latest")


def _normalize_ollama_base(url: str) -> Optional[str]:
    """Return stripped base URL or None if invalid."""
    raw = (url or "").strip().rstrip("/")
    if not raw:
        return None
    if len(raw) > 256:
        return None
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return raw


def summarize_with_ollama(
    text: str,
    language: str = "english",
    base: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """Summarise text via Ollama POST /api/chat."""
    resolved_base = _normalize_ollama_base(base) if base else None
    if not resolved_base:
        resolved_base = _ollama_base()
    resolved_model = (model or "").strip() or _ollama_model()
    url = f"{resolved_base}/api/chat"

    prompt = f"Please summarize the following text (maximum 220 words):\n\n{text}"

    if language == "portuguese":
        prompt += "\n\nAnswer only using Portuguese words."
    else:
        prompt += "\n\nAnswer only using English words."

    system = (
        "You are a helpful Law assistant that summarizes text documents clearly. "
        "You help users understand legal material for Portugal, UK and Europe. "
        "Be concise; no emojis. Reply with the summary only—no long step-by-step reasoning "
        "instead of the summary."
    )

    payload = {
        "model": resolved_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        # num_predict: max new tokens (reasoning models often need >1000 before `content` is filled).
        "options": {"temperature": 0.3, "num_predict": 8192},
    }

    try:
        r = requests.post(url, json=payload, timeout=300)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.ConnectionError as e:
        return (
            f"Error: cannot reach Ollama at {resolved_base}. Is it running? ({e})"
        )
    except requests.exceptions.HTTPError as e:
        body = ""
        try:
            body = e.response.text[:500] if e.response is not None else ""
        except Exception:
            pass
        return f"Error from Ollama ({e.response.status_code if e.response else '?'}): {body or e}"
    except requests.exceptions.RequestException as e:
        return f"Error calling Ollama: {e}"

    message = data.get("message") or {}
    if not isinstance(message, dict):
        message = {}

    def _msg_text(key: str) -> str:
        val = message.get(key)
        return (val if isinstance(val, str) else "").strip()

    content = _msg_text("content")
    if content:
        return content

    thinking = _msg_text("thinking")
    if thinking:
        return thinking

    done = data.get("done_reason")
    return (
        "Error: Ollama returned an empty reply. "
        f"If this is a reasoning model, try increasing context/output in Ollama or switch models. "
        f"(done_reason={done!r})"
    )


def pdf_bytes_to_text(pdf_bytes: bytes) -> Tuple[List[dict], str]:
    """Extract text from PDF bytes using pypdf."""
    pages: List[dict] = []
    reader = PdfReader(io.BytesIO(pdf_bytes))

    for i, page in enumerate(reader.pages):
        try:
            text = (page.extract_text() or "").strip()
            pages.append({"page": i + 1, "text": text})
        except Exception as e:
            pages.append({"page": i + 1, "text": f"[Page processing failed: {str(e)}]"})

    full_text = "\n\n".join(f"=== Page {p['page']} ===\n{p['text']}" for p in pages)
    return pages, full_text


def _is_pdf_magic(data: bytes) -> bool:
    return len(data) >= 4 and data[:4] == b"%PDF"


@app.get("/", response_class=HTMLResponse)
def root():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.get("/api/health")
def health(base: Optional[str] = None):
    resolved = _normalize_ollama_base(base) if base else None
    if not resolved:
        resolved = _ollama_base()
    try:
        r = requests.get(f"{resolved}/api/tags", timeout=2)
        r.raise_for_status()
        return {"status": "ok", "ollama": "ready", "host": resolved, "model": _ollama_model()}
    except requests.exceptions.RequestException as e:
        return JSONResponse(
            {
                "status": "error",
                "ollama": "unreachable",
                "host": resolved,
                "detail": str(e),
            },
            status_code=503,
        )


@app.get("/api/ollama/models")
def ollama_models(base: Optional[str] = None):
    """Proxy Ollama GET /api/tags so the browser avoids CORS issues."""
    resolved = _normalize_ollama_base(base) if base else None
    if not resolved:
        resolved = _ollama_base()
    try:
        r = requests.get(f"{resolved}/api/tags", timeout=8)
        r.raise_for_status()
        data = r.json()
        models = sorted(
            m["name"]
            for m in (data.get("models") or [])
            if isinstance(m, dict) and m.get("name")
        )
        return {"host": resolved, "models": models}
    except requests.exceptions.RequestException as e:
        return JSONResponse(
            {"error": str(e), "host": resolved, "models": []},
            status_code=502,
        )


@app.post("/api/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """Extract text from PDF using pypdf."""
    raw = await file.read()
    ct = (file.content_type or "").split(";")[0].strip().lower()

    is_pdf = ct == "application/pdf" or (ct == "application/octet-stream" and _is_pdf_magic(raw))

    if not is_pdf:
        return JSONResponse({"error": "Please upload a PDF file."}, status_code=400)

    try:
        pages, full_text = pdf_bytes_to_text(raw)
    except Exception as e:
        return JSONResponse({"error": f"Failed to process PDF: {e}"}, status_code=500)

    return {
        "num_pages": len(pages),
        "pages": pages,
        "full_text": full_text,
    }


@app.post("/api/process-text")
async def process_text(
    text: str = Form(...),
    language: str = Form("english"),
    ollama_base: Optional[str] = Form(None),
    ollama_model: Optional[str] = Form(None),
):
    """Summarise text using Ollama."""
    processed_text = summarize_with_ollama(
        text,
        language,
        base=ollama_base,
        model=ollama_model,
    )
    if processed_text.startswith("Error:"):
        return JSONResponse({"error": processed_text}, status_code=502)

    return {
        "original_text": text,
        "processed_text": processed_text,
        "language": language,
    }


