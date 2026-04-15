"""
Backend implementations for legal-mcp.

Backends provide access to external services and data sources,
such as LLM providers (Ollama, OpenAI, etc.), PDF processors, and data sources.
"""

from .legal_research import get_backend, run_legal_research

__all__ = [
	"get_backend",
	"run_legal_research",
]
