import io
import os
from typing import List, Optional
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from pypdf import PdfReader
import openai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()





app = FastAPI(title="legal-atlas", version="1.0")

# CORS for local dev; tighten in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the static front-end
app.mount("/static", StaticFiles(directory="static"), name="static")





def process_with_openai(text: str, task: str = "analyze", language: str = "english") -> str:
    """
    Process text using OpenAI API
    """
    try:
        # Get OpenAI API key from environment variables
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return "Error: OPENAI_API_KEY not found in environment variables. Please set it in your .env file."
        
        client = openai.OpenAI(api_key=api_key)
        
        if task == "analyze":
            prompt = f"Please analyze the following text and provide insights:\n\n{text}"
        elif task == "summarize":
            prompt = f"Please summarize the following text (maximum 220 words):\n\n{text}"
        elif task == "extract_key_points":
            prompt = f"Please extract the key points from the following text (max 10 key points):\n\n{text}"
        else:
            prompt = f"Please process the following text:\n\n{text}"
        
        # Add language instruction to the prompt
        if language == "portuguese":
            prompt += "\n\nAnswer only using Portuguese words."
        else:
            prompt += "\n\nAnswer only using English words."
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful Law assistant that processes, analyzes and summarizest text documents. You are very experienced and will help users understand and generate legal documents for Portugal, UK and Europe Law. Be concise in the answers you provide and not very long, no emojis."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        return f"Error processing with OpenAI: {str(e)}"


def pdf_bytes_to_text(pdf_bytes: bytes):
    """
    Extract text from PDF bytes using pypdf
    """
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





@app.get("/", response_class=HTMLResponse)
def root():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/api/health")
def health():
    return {"status": "ok", "openai": "ready"}

@app.post("/api/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """
    Extract text from PDF using pypdf only (no OpenAI processing)
    Used by the Text Extractor tab
    """
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        return JSONResponse({"error": "Please upload a PDF file."}, status_code=400)

    pdf_bytes = await file.read()

    try:
        pages, full_text = pdf_bytes_to_text(pdf_bytes)
    except Exception as e:
        return JSONResponse({"error": f"Failed to process PDF: {e}"}, status_code=500)

    return {
        "num_pages": len(pages), 
        "pages": pages, 
        "full_text": full_text
    }

@app.post("/api/process-text")
async def process_text(
    text: str = Form(...),
    task: str = Form("analyze"),
    language: str = Form("english")
):
    """
    Process text using OpenAI API
    Used by the Legal Document Generator tab
    """
    try:
        processed_text = process_with_openai(text, task, language)
    except Exception as e:
        return JSONResponse({"error": f"Failed to process text: {e}"}, status_code=500)

    return {
        "original_text": text,
        "processed_text": processed_text,
        "task": task,
        "language": language
    }








# Run with: uvicorn app:app --reload
