"""Ollama backend for LLM operations."""

import os
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests


def get_ollama_base() -> str:
    """Get Ollama base URL from environment or use default."""
    return os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")


def get_ollama_model() -> str:
    """Get Ollama model from environment or use default."""
    return os.getenv("OLLAMA_MODEL", "glm-4.7-flash:latest")


def normalize_ollama_base(url: str) -> Optional[str]:
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
    resolved_base = normalize_ollama_base(base) if base else None
    if not resolved_base:
        resolved_base = get_ollama_base()
    resolved_model = (model or "").strip() or get_ollama_model()
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
        "options": {"temperature": 0.3, "num_predict": 8192},
    }

    try:
        r = requests.post(url, json=payload, timeout=300)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.ConnectionError as e:
        return f"Error: cannot reach Ollama at {resolved_base}. Is it running? ({e})"
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


def chat_with_ollama(
    messages: List[Dict[str, Any]],
    base: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """Chat with Ollama POST /api/chat using a role/content message list."""
    resolved_base = normalize_ollama_base(base) if base else None
    if not resolved_base:
        resolved_base = get_ollama_base()
    resolved_model = (model or "").strip() or get_ollama_model()
    url = f"{resolved_base}/api/chat"

    cleaned_messages: List[Dict[str, str]] = []
    for msg in messages or []:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).strip().lower()
        content = str(msg.get("content", "")).strip()
        if role not in {"system", "user", "assistant"} or not content:
            continue
        cleaned_messages.append({"role": role, "content": content})

    if not cleaned_messages:
        return "Error: chat requires at least one valid message."

    payload = {
        "model": resolved_model,
        "messages": cleaned_messages,
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 8192},
    }

    try:
        r = requests.post(url, json=payload, timeout=300)
        r.raise_for_status()
        data = r.json()
    except requests.exceptions.ConnectionError as e:
        return f"Error: cannot reach Ollama at {resolved_base}. Is it running? ({e})"
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

    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()

    thinking = message.get("thinking")
    if isinstance(thinking, str) and thinking.strip():
        return thinking.strip()

    done = data.get("done_reason")
    return f"Error: Ollama returned an empty reply (done_reason={done!r})"
