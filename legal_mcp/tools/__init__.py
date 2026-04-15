"""
MCP tools for legal document analysis.

Each tool module should follow the convention:
- Module named as: legal_mcp/tools/<tool_name>.py
- Exposes an async handler: handle_<tool_name>(args: dict) -> dict
"""

from .legal_research import handle_legal_research

__all__ = ["handle_legal_research"]
