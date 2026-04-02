import io
import os
from typing import List, Tuple

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


def process_with_ollama(text: str, task: str = "analyze", language: str = "english") -> str:
    """Process text via Ollama POST /api/chat."""
    base = _ollama_base()
    model = _ollama_model()
    url = f"{base}/api/chat"

    if task == "analyze":
        prompt = f"Please analyze the following text and provide insights:\n\n{text}"
    elif task == "summarize":
        prompt = f"Please summarize the following text (maximum 220 words):\n\n{text}"
    elif task == "extract_key_points":
        prompt = f"Please extract the key points from the following text (max 10 key points):\n\n{text}"
    else:
        prompt = f"Please process the following text:\n\n{text}"

    if language == "portuguese":
        prompt += "\n\nAnswer only using Portuguese words."
    else:
        prompt += "\n\nAnswer only using English words."

    system = (
        "You are a helpful Law assistant that processes, analyzes and summarizes text documents. "
        "You are very experienced and will help users understand and generate legal documents for "
        "Portugal, UK and Europe Law. Be concise in the answers you provide and not very long, no emojis."
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 1000},
    }

    try:
        r = requests.post(url, json=payload, timeout=300)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.ConnectionError as e:
        return (
            f"Error: cannot reach Ollama at {base}. Is it running? ({e})"
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
    content = message.get("content")
    if not content:
        return f"Error: unexpected Ollama response: {data!r}"
    return content


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
def health():
    base = _ollama_base()
    try:
        r = requests.get(f"{base}/api/tags", timeout=2)
        r.raise_for_status()
        return {"status": "ok", "ollama": "ready", "host": base, "model": _ollama_model()}
    except requests.exceptions.RequestException as e:
        return JSONResponse(
            {
                "status": "error",
                "ollama": "unreachable",
                "host": base,
                "detail": str(e),
            },
            status_code=503,
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
    task: str = Form("analyze"),
    language: str = Form("english"),
):
    """Process text using Ollama."""
    processed_text = process_with_ollama(text, task, language)
    if processed_text.startswith("Error:"):
        return JSONResponse({"error": processed_text}, status_code=502)

    return {
        "original_text": text,
        "processed_text": processed_text,
        "task": task,
        "language": language,
    }


