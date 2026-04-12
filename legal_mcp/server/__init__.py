"""MCP Server initialization and route registration."""

from typing import Optional

from dotenv import load_dotenv
from fastapi import File, Form, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse

from legal_mcp.backends.ollama import (
    get_ollama_base,
    get_ollama_model,
    normalize_ollama_base,
    summarize_with_ollama,
)
from legal_mcp.domain.pdf import is_pdf_magic, pdf_bytes_to_text

from .app import create_app

# Load environment variables
load_dotenv()

# Create the FastAPI app instance
app = create_app()


def register_routes(server) -> None:
    """Register all API routes for the legal-mcp server.
    
    This function sets up the HTTP endpoints that expose the MCP tools
    through a REST API, along with utility endpoints for server health
    and static content.
    """

    @server.get("/", response_class=HTMLResponse)
    def root():
        """Serve the main HTML page."""
        with open("static/index.html", "r", encoding="utf-8") as f:
            return f.read()

    @server.get("/api/health")
    def health(base: Optional[str] = None):
        """Check health status and Ollama connectivity."""
        resolved = normalize_ollama_base(base) if base else None
        if not resolved:
            resolved = get_ollama_base()
        try:
            import requests

            r = requests.get(f"{resolved}/api/tags", timeout=2)
            r.raise_for_status()
            return {
                "status": "ok",
                "ollama": "ready",
                "host": resolved,
                "model": get_ollama_model(),
            }
        except Exception as e:
            return JSONResponse(
                {
                    "status": "error",
                    "ollama": "unreachable",
                    "host": resolved,
                    "detail": str(e),
                },
                status_code=503,
            )

    @server.get("/api/ollama/models")
    def ollama_models(base: Optional[str] = None):
        """Proxy Ollama GET /api/tags to avoid browser CORS issues."""
        import requests

        resolved = normalize_ollama_base(base) if base else None
        if not resolved:
            resolved = get_ollama_base()
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
        except Exception as e:
            return JSONResponse(
                {"error": str(e), "host": resolved, "models": []},
                status_code=502,
            )

    @server.post("/api/extract-text")
    async def extract_text(file: UploadFile = File(...)):
        """Extract text from PDF using pypdf."""
        raw = await file.read()
        ct = (file.content_type or "").split(";")[0].strip().lower()

        is_pdf = ct == "application/pdf" or (
            ct == "application/octet-stream" and is_pdf_magic(raw)
        )

        if not is_pdf:
            return JSONResponse(
                {"error": "Please upload a PDF file."}, status_code=400
            )

        try:
            pages, full_text = pdf_bytes_to_text(raw)
        except Exception as e:
            return JSONResponse(
                {"error": f"Failed to process PDF: {e}"}, status_code=500
            )

        return {
            "num_pages": len(pages),
            "pages": pages,
            "full_text": full_text,
        }

    @server.post("/api/process-text")
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


# Register routes on the app instance
register_routes(app)


def run_stdio_server() -> None:
    """Run the MCP server with stdio transport.
    
    This is a placeholder for MCP stdio server implementation.
    Currently, the server runs via FastAPI/uvicorn through CLI.
    """
    pass
