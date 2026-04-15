"""Tests for legal_research MCP tool handler."""

import pytest

from legal_mcp.tools.legal_research import handle_legal_research


@pytest.mark.asyncio
async def test_handle_legal_research_returns_context_and_results() -> None:
    result = await handle_legal_research(
        {
            "query": "termination clause notice period",
            "country": "PT",
            "domain": "employment",
            "limit": 2,
        }
    )

    assert "error" not in result
    assert result["context"] == {"country": "PT", "domain": "employment"}
    assert len(result["results"]) == 2
    assert "title" in result["results"][0]


@pytest.mark.asyncio
async def test_handle_legal_research_requires_query() -> None:
    result = await handle_legal_research({"country": "EU", "domain": "general"})
    assert result == {"error": "query is required"}
