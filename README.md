# legal-mcp

A professional Python MCP server for legal understanding.

## Quick Start

```sh
uv sync
uv run python -m legal_mcp.server
```

Server runs at `http://127.0.0.1:8080`

## Project Structure

```
legal_mcp/
├── domain/           Business logic layer (PDF extraction, document handling)
├── backends/         External service integrations (Ollama LLM, etc.)
├── tools/            MCP tool implementations (scaffold for future tools)
├── server/           FastAPI app and HTTP route handlers
├── __init__.py       Package initialization
└── __main__.py       Module entry point
```

## Development Commands

All commands use `uv` for consistency:

```bash
# Format code
uv run black legal_mcp tests
uv run ruff format legal_mcp tests

# Lint code
uv run ruff check legal_mcp tests

# Run tests
uv run pytest tests/ -v

# Or use Makefile shortcuts
make format
make lint
make test
```

## Running the Server

### Via module entry point (recommended)
```bash
uv run python -m legal_mcp.server
```

### Via console script (after install)
```bash
legal-mcp-server
```

### Development with hot reload
```bash
uv run uvicorn legal_mcp.server:app --host 127.0.0.1 --port 8080 --reload
```

## API Endpoints

- `GET /` - Main HTML interface
- `GET /api/health` - Health check & Ollama status
- `GET /api/ollama/models` - List available Ollama models
- `POST /api/extract-text` - Extract text from PDF
- `POST /api/process-text` - Summarize text via Ollama

## Dependencies

- Dependencies are listed in `pyproject.toml` (`[project].dependencies`)
- After cloning, `uv sync` installs exactly what `uv.lock` pins
- Dev dependencies: black, ruff, pytest (installed with `[dev]` extra)

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Package structure and design
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines

