import io
from typing import List, Optional, Tuple

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from pypdf import PdfReader

import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image

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

device = "cuda" if torch.cuda.is_available() else "cpu"

_processor = None
_model = None

def load_ocr():
    global _processor, _model
    if _processor is None or _model is None:
        _processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-printed")
        _model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-printed")
        _model.to(device)
        _model.eval()

@torch.inference_mode()
def ocr_pil(img: Image.Image) -> str:
    load_ocr()
    pixel_values = _processor(images=img, return_tensors="pt").pixel_values.to(device)
    generated_ids = _model.generate(pixel_values, max_length=512)
    text = _processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return (text or "").strip()

def _largest_image_from_page(reader_page) -> Optional[Tuple[bytes, str]]:
    """
    Try to extract the largest embedded image (by pixel area) from a page.
    Returns (image_bytes, image_ext) or None.
    """
    # pypdf exposed APIs evolved; try page.images if available, else get_images()
    images = []
    if hasattr(reader_page, "images"):
        images = list(reader_page.images)
    elif hasattr(reader_page, "get_images"):
        # older signature: get_images(full=True) -> list of tuples
        try:
            images = reader_page.get_images(full=True)  # PyPDF2-style
        except TypeError:
            images = reader_page.get_images()
    if not images:
        return None

    # Normalize to a list of dicts with width/height/xref
    norm = []
    for item in images:
        if isinstance(item, dict):
            xref = item.get("xref")
            width = int(item.get("width", 0))
            height = int(item.get("height", 0))
            smask = item.get("smask")
        else:
            # PyPDF2 tuple format: (xref, smask, width, height, bpc, colorspace, filter, decode, name, ...) 
            xref = item[0] if len(item) > 0 else None
            smask = item[1] if len(item) > 1 else None
            width = int(item[2] if len(item) > 2 else 0)
            height = int(item[3] if len(item) > 3 else 0)
        if xref is None:
            continue
        norm.append({"xref": xref, "width": width, "height": height, "smask": smask})

    if not norm:
        return None

    norm.sort(key=lambda d: d["width"] * d["height"], reverse=True)
    best = norm[0]

    # pypdf reader provides .images but extraction needs PdfReader.extract_image(xref) via reader
    # We need the owning reader; access through the page object's indirect reference
    # Workaround: PdfReader's public API since v3: reader.images and reader.extract_image(xref).
    # Here we get the reader by walking attributes (page._pdf or page.pdf)
    pdf_reader = getattr(reader_page, "pdf", None) or getattr(reader_page, "_pdf", None)
    if pdf_reader is None and hasattr(reader_page, "indirect_reference"):
        pdf_reader = getattr(reader_page.indirect_reference, "pdf", None)

    if pdf_reader is None:
        return None

    try:
        img = pdf_reader.extract_image(best["xref"])
        img_bytes = img.get("image")
        img_ext = img.get("ext", "png")
        if img_bytes:
            return img_bytes, img_ext
    except Exception:
        pass

    return None

def pdf_bytes_to_text_or_ocr(pdf_bytes: bytes, max_pages: int = 0):
    pages: List[dict] = []
    reader = PdfReader(io.BytesIO(pdf_bytes))

    for i, page in enumerate(reader.pages):
        if max_pages and i >= max_pages:
            break

        native_text = (page.extract_text() or "").strip()
        if native_text:
            pages.append({"page": i + 1, "source": "native text", "text": native_text})
            continue

        # If no native text, try to extract the largest embedded image and OCR it.
        extracted = _largest_image_from_page(page)
        if extracted is None:
            # Nothing to OCR; return empty
            pages.append({"page": i + 1, "source": "OCR text", "text": ""})
            continue

        img_bytes, img_ext = extracted
        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        except Exception:
            pages.append({"page": i + 1, "source": "ocr", "text": ""})
            continue

        text = ocr_pil(img)
        pages.append({"page": i + 1, "source": "ocr", "text": text})

    full_text = "\n\n".join(f"=== Page {p['page']} ({p['source']}) ===\n{p['text']}" for p in pages)
    return pages, full_text

@app.get("/", response_class=HTMLResponse)
def root():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/api/health")
def health():
    return {"status": "ok", "device": device, "cuda": torch.cuda.is_available()}

@app.post("/api/extract-text")
async def extract_text(
    file: UploadFile = File(...),
    max_pages: int = Form(0),  # 0 = all
):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        return JSONResponse({"error": "Please upload a PDF file."}, status_code=400)

    pdf_bytes = await file.read()

    try:
        pages, full_text = pdf_bytes_to_text_or_ocr(pdf_bytes, max_pages=max_pages)
    except Exception as e:
        return JSONResponse({"error": f"Failed to process PDF: {e}"}, status_code=500)

    return {"num_pages": len(pages), "pages": pages, "full_text": full_text}

# Run with: uvicorn app:app --reload
