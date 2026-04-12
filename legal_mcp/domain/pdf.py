"""Domain logic for PDF document handling."""

import io
from typing import List, Tuple

from pypdf import PdfReader


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


def is_pdf_magic(data: bytes) -> bool:
    """Check if the data has PDF magic bytes."""
    return len(data) >= 4 and data[:4] == b"%PDF"
