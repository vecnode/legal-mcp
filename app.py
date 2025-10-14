import io
from typing import List, Optional, Tuple

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from pypdf import PdfReader

from PIL import Image
import easyocr
import numpy as np



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

_easyocr_reader = None

def load_easyocr():
    global _easyocr_reader
    if _easyocr_reader is None:
        print("Loading EasyOCR")
        try:
            # EasyOCR will automatically detect and use GPU if available
            _easyocr_reader = easyocr.Reader(['en'])
            print("EasyOCR loaded successfully")
        except Exception as e:
            print(f"Error loading EasyOCR: {e}")
            raise

def ocr_pil(img: Image.Image) -> str:
    load_easyocr()
    # Convert PIL image to numpy array for EasyOCR
    img_array = np.array(img)
    
    # Use EasyOCR to extract text
    results = _easyocr_reader.readtext(img_array)
    
    # Combine all detected text
    extracted_text = ""
    for (bbox, text, confidence) in results:
        if confidence > 0.5:  # Only include high-confidence text
            extracted_text += text + " "
    
    return extracted_text.strip()

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
        try:
            if isinstance(item, dict):
                xref = item.get("xref")
                width = int(item.get("width", 0))
                height = int(item.get("height", 0))
                smask = item.get("smask")
            else:
                # PyPDF2 tuple format: (xref, smask, width, height, bpc, colorspace, filter, decode, name, ...) 
                # Handle ImageFile objects and other types gracefully
                try:
                    xref = item[0] if len(item) > 0 else None
                    smask = item[1] if len(item) > 1 else None
                    width = int(item[2] if len(item) > 2 else 0)
                    height = int(item[3] if len(item) > 3 else 0)
                except (TypeError, AttributeError):
                    # Skip items that can't be processed (like ImageFile objects)
                    continue
            if xref is None:
                continue
            norm.append({"xref": xref, "width": width, "height": height, "smask": smask})
        except Exception:
            # Skip any problematic items and continue processing
            continue

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

def pdf_bytes_to_text_or_ocr(pdf_bytes: bytes):
    pages: List[dict] = []
    reader = PdfReader(io.BytesIO(pdf_bytes))

    for i, page in enumerate(reader.pages):
        try:
            native_text = (page.extract_text() or "").strip()
            if native_text:
                pages.append({"page": i + 1, "source": "native text", "text": native_text})
                continue

            # If no native text, try to extract the largest embedded image and OCR it.
            try:
                extracted = _largest_image_from_page(page)
                if extracted is None:
                    # Nothing to OCR; return empty
                    pages.append({"page": i + 1, "source": "OCR text", "text": ""})
                    continue

                img_bytes, img_ext = extracted
                try:
                    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                except Exception:
                    pages.append({"page": i + 1, "source": "OCR text", "text": ""})
                    continue

                text = ocr_pil(img)
                pages.append({"page": i + 1, "source": "OCR text", "text": text})
            except Exception as e:
                # If image extraction fails, add empty page and continue
                pages.append({"page": i + 1, "source": "OCR text", "text": f"[Image processing failed: {str(e)}]"})
                continue
        except Exception as e:
            # If entire page processing fails, add error message and continue
            pages.append({"page": i + 1, "source": "error", "text": f"[Page processing failed: {str(e)}]"})
            continue

    full_text = "\n\n".join(f"=== Page {p['page']} ({p['source']}) ===\n{p['text']}" for p in pages)
    return pages, full_text





@app.get("/", response_class=HTMLResponse)
def root():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/api/health")
def health():
    return {"status": "ok", "easyocr": "ready"}

@app.post("/api/extract-text")
async def extract_text(
    file: UploadFile = File(...),
):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        return JSONResponse({"error": "Please upload a PDF file."}, status_code=400)

    pdf_bytes = await file.read()

    try:
        pages, full_text = pdf_bytes_to_text_or_ocr(pdf_bytes)
    except Exception as e:
        return JSONResponse({"error": f"Failed to process PDF: {e}"}, status_code=500)

    return {"num_pages": len(pages), "pages": pages, "full_text": full_text}




@app.post("/api/extract-image")
async def extract_image(
    file: UploadFile = File(...),
):
    # Check if it's an image file
    if not file.content_type or not file.content_type.startswith("image/"):
        return JSONResponse({"error": "Please upload an image file (PNG, JPG, JPEG)."}, status_code=400)

    try:
        print(f"Processing image: {file.filename}, content_type: {file.content_type}")
        
        # Read the uploaded image
        image_bytes = await file.read()
        print(f"Image size: {len(image_bytes)} bytes")
        
        # Open and normalize the image format
        image = Image.open(io.BytesIO(image_bytes))
        print(f"Image opened: {image.size}, mode: {image.mode}")
        
        # Convert to RGB format (required by TrOCR)
        if image.mode != 'RGB':
            image = image.convert('RGB')
            print(f"Converted to RGB: {image.size}, mode: {image.mode}")
        
        # Enhance image for better OCR
        from PIL import ImageEnhance, ImageFilter
        
        # Convert to grayscale first (often better for OCR)
        if image.mode != 'L':
            image = image.convert('L')
            print(f"Converted to grayscale: {image.size}, mode: {image.mode}")
        
        # Increase contrast for better text recognition
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)  # Higher contrast
        
        # Increase brightness if needed
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(1.1)
        
        # Convert back to RGB for TrOCR
        image = image.convert('RGB')
        print(f"Final image: {image.size}, mode: {image.mode}")
        
        # Optional: Resize if image is too large (TrOCR works best with reasonable sizes)
        max_size = 1024
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
            print(f"Resized to: {image.size}")
        
        print("Image preprocessing completed")
        
        # Process with EasyOCR
        print("Loading EasyOCR")
        load_easyocr()  # Ensure EasyOCR is loaded
        print("EasyOCR loaded successfully")
        
        print("Processing with EasyOCR")
        # Convert PIL image to numpy array for EasyOCR
        img_array = np.array(image)
        
        # Use EasyOCR to extract text
        results = _easyocr_reader.readtext(img_array)
        
        # Combine all detected text
        extracted_text = ""
        for (bbox, text, confidence) in results:
            if confidence > 0.5:  # Only include high-confidence text
                extracted_text += text + " "
        
        extracted_text = extracted_text.strip()
        print(f"EasyOCR extracted text: '{extracted_text}'")
        
        return {
            "filename": file.filename,
            "content_type": file.content_type,
            "extracted_text": extracted_text,
            "source": "OCR from image"
        }
        
    except Exception as e:
        print(f"Error processing image: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse({"error": f"Failed to process image: {str(e)}"}, status_code=500)

# Run with: uvicorn app:app --reload
