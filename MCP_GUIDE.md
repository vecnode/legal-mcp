# MCP Guide

This guide defines the contributor pattern for building MCP tools in this repository.

## Layered architecture

Use this flow for every tool:

1. `legal_mcp.domain.*`: request/response models and pure business rules.
2. `legal_mcp.backends.*`: integrations with search APIs, databases, LLMs, or local indexes.
3. `legal_mcp.tools.*`: thin async MCP handler that maps `args` to typed models and returns JSON-safe dicts.
4. `legal_mcp.server.*`: route/server registration layer.

## LegalContext-first pattern

Every tool should parse legal context before building requests:

- Parse with `LegalContext.from_args(args)` from `legal_mcp.domain.context`.
- Normalize country + domain early.
- Pass context into request objects and backend selection.

Current canonical example: `legal_mcp.tools.legal_research.handle_legal_research`.

## Checklist: add a new MCP tool

1. Choose a tool name and one-sentence description.
2. Add/extend domain types under `legal_mcp.domain.*`.
3. Implement or reuse backend logic under `legal_mcp.backends.*`.
4. Add a thin handler under `legal_mcp.tools.*`:
   - Parse `LegalContext` via `LegalContext.from_args(args)`.
   - Build strongly typed request object(s).
   - Call backend (optionally via `get_backend(ctx.country, ctx.domain)`).
   - Return JSON-serializable dicts only.
5. Register the tool and input schema in the MCP server manifest/config.
6. Add at least one basic handler test in `tests/`.

## Full example vertical slice (research-style)

### 1) Domain request/response

```python
# legal_mcp/domain/legal_research.py
from dataclasses import dataclass

@dataclass(frozen=True)
class LegalResearchRequest:
    query: str
    country: str
    domain: str
    limit: int = 5

@dataclass(frozen=True)
class LegalResearchResult:
    title: str
    source: str
    summary: str

    def to_dict(self) -> dict:
        return {"title": self.title, "source": self.source, "summary": self.summary}
```

### 2) Backend

```python
# legal_mcp/backends/legal_research.py
from typing import List
from legal_mcp.domain.legal_research import LegalResearchRequest, LegalResearchResult

def get_backend(country: str, domain: str) -> str:
    return f"default:{country.lower()}:{domain}"

def run_legal_research(req: LegalResearchRequest) -> List[LegalResearchResult]:
    return []
```

### 3) MCP tool handler

```python
# legal_mcp/tools/legal_research.py
from legal_mcp.domain.context import LegalContext
from legal_mcp.domain.legal_research import LegalResearchRequest
from legal_mcp.backends.legal_research import run_legal_research

async def handle_legal_research(args: dict) -> dict:
    ctx = LegalContext.from_args(args)
    req = LegalResearchRequest(
        query=args["query"],
        country=ctx.country,
        domain=ctx.domain,
    )
    results = run_legal_research(req)
    return {
        "context": ctx.to_dict(),
        "results": [r.to_dict() for r in results],
    }
```

### 4) Manifest snippet template

```json
{
  "name": "legal_research",
  "description": "Search legal authorities and summarize relevant findings.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "country": {
        "type": "string",
        "description": "Country code (US, EU, DE, PT, UK, BR)"
      },
      "domain": {
        "type": "string",
        "description": "Legal domain: general, contract, employment, tax, data_protection, ip"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10
      }
    },
    "required": ["query"]
  }
}
```

## Reference modules

Use these as the baseline implementation style:

- `legal_mcp.tools.legal_research` for research/query tools.
- `legal_mcp.domain.context` for context parsing and normalization.
- `legal_mcp.backends.ollama` for external backend integration style.

Planned tools should follow the same pattern:

- `legal_mcp.tools.legal_doc_analysis`
- `legal_mcp.tools.citation_checker`
- `legal_mcp.tools.pdf_search`
