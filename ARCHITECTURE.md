# Architecture

## Overview

`legal-mcp` is a professional Python Model Context Protocol (MCP) server designed for legal document analysis. The project follows a layered architecture that separates concerns and makes the codebase maintainable, testable, and extensible.

## Package Structure

```
legal_mcp/
├── __init__.py                 # Package initialization and version
├── domain/                     # Business logic layer
│   ├── __init__.py
│   └── pdf.py                  # PDF document handling
├── backends/                   # External service integrations
│   ├── __init__.py
│   └── ollama.py               # Ollama LLM backend
├── tools/                      # MCP tools (future: tool implementations)
│   └── __init__.py
├── server/                     # FastAPI server and routing
│   ├── __init__.py            # Route registration
│   ├── __main__.py            # Module entry point
│   ├── app.py                  # FastAPI app creation
│   └── main.py                 # Console script entry point
├── tests/                      # Test suite
│   └── __init__.py
├── pyproject.toml              # Project metadata and dependencies
├── Makefile                    # Local development commands
├── ARCHITECTURE.md             # This file
└── CONTRIBUTING.md             # Development guidelines
```

## Layered Architecture

### 1. Domain Layer (`legal_mcp/domain/`)

Pure business logic independent of external frameworks:
- **`pdf.py`**: PDF extraction and processing
- No external dependencies (except stdlib and pypdf)
- Easy to test and reuse

### 2. Backends Layer (`legal_mcp/backends/`)

Integrations with external services:
- **`ollama.py`**: LLM operations via Ollama API
- Handles API communication, error handling, configuration
- Substitutable with different LLM providers

### 3. Tools Layer (`legal_mcp/tools/`)

MCP tool implementations following the handler convention:
- Each tool: `legal_mcp/tools/<tool_name>.py`
- Each tool exposes: `async def handle_<tool_name>(args: dict) -> dict`
- Tools orchestrate backends and domain logic

### 4. Server Layer (`legal_mcp/server/`)

FastAPI HTTP server and request handling:
- **`app.py`**: FastAPI application factory
- **`__init__.py`**: Route registration and coordination
- **`__main__.py`**: Module entry point (e.g., `python -m legal_mcp.server`)
- **`main.py`**: Console script entry point (e.g., `legal-mcp-server`)

## Naming Conventions

### Python Package vs Project Name
- **Package (importable)**: `legal_mcp` (underscores) → `import legal_mcp`
- **Project (repository)**: `legal-mcp` (dashes) → `git clone legal-mcp`

### MCP Tool Naming
All tool modules follow this pattern for consistency between MCP concepts and Python code:
- **File**: `legal_mcp/tools/<tool_name>.py` (MCP tool name with underscores)
- **Handler**: `async def handle_<tool_name>(args: dict) -> dict`
- **Registration**: Server registers tool as `tool_name` (matching MCP manifest)

Example:
```python
# legal_mcp/tools/legal_research.py
async def handle_legal_research(args: dict) -> dict:
    """Handle legal research MCP tool."""
    # Implementation here
    return {"result": "..."}
```

## Entry Points

### Command-line execution:
```bash
# Via console script (after pip install -e .)
legal-mcp-server

# Via module invocation
python -m legal_mcp.server

# Via uvicorn directly (during development)
uv run uvicorn legal_mcp.server:app --host 127.0.0.1 --port 8080 --reload
```

## Development Workflow

Local development commands (via Makefile):
```bash
make dev-install    # Install with dev dependencies
make format         # Format code (black + ruff)
make lint           # Run linters
make test           # Run tests
make clean          # Remove build artifacts
```

Or using `uv`:
```bash
uv sync             # Install exact dependencies from lock file
uv run black legal_mcp tests
uv run pytest tests/
```

## Future Considerations

- **MCP Tools**: Implement specific legal research, document analysis, and citation checking tools
- **Persistence**: Add database layer for document storage and caching
- **Authentication**: Secure API with token-based auth or similar
- **CI/CD**: Add GitHub Actions or similar for automated testing and linting
- **API Documentation**: Generate and host OpenAPI docs
