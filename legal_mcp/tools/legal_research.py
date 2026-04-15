"""MCP tool handler for legal research."""

from legal_mcp.backends.legal_research import run_legal_research
from legal_mcp.domain.context import LegalContext
from legal_mcp.domain.legal_research import LegalResearchRequest


async def handle_legal_research(args: dict) -> dict:
    """Handle legal_research MCP tool calls.

    Expected args:
    - query: str (required)
    - country: str (optional)
    - domain: str (optional)
    - limit: int (optional)
    """
    ctx = LegalContext.from_args(args)
    query = str(args.get("query", "")).strip()
    if not query:
        return {"error": "query is required"}

    try:
        limit = int(args.get("limit", 5))
    except (TypeError, ValueError):
        limit = 5

    req = LegalResearchRequest(
        query=query,
        country=ctx.country,
        domain=ctx.domain,
        limit=limit,
    )
    results = run_legal_research(req)

    return {
        "context": ctx.to_dict(),
        "results": [result.to_dict() for result in results],
    }
