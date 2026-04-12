# Contributing

## Development Setup

### Prerequisites
- Python 3.10 or higher
- `uv` or `pip` for package management
- `make` (optional, for convenience commands)

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd legal-mcp
   uv sync
   source .venv/bin/activate  # or use uv run
   ```

2. **Install in editable mode with dev dependencies**:
   ```bash
   make dev-install
   # or manually:
   pip install -e ".[dev]"
   ```

3. **Run tests**:
   ```bash
   make test
   # or:
   pytest tests/ -v
   ```

## Code Style

We follow PEP 8 with some conventions:
- Line length: 100 characters
- Tool: `black` for formatting
- Tool: `ruff` for linting

### Format your code:
```bash
make format
# or:
black legal_mcp tests
ruff format legal_mcp tests
```

### Lint your code:
```bash
make lint
# or:
ruff check legal_mcp tests
```

## Package Structure

When adding new code:

1. **Domain logic** → `legal_mcp/domain/`
   - Pure functions, no framework dependencies
   - Easy to test in isolation

2. **External integrations** → `legal_mcp/backends/`
   - API clients, LLM providers, services
   - Handle configuration and error handling

3. **MCP Tools** → `legal_mcp/tools/`
   - Tool implementations following handler convention
   - File: `legal_mcp/tools/<tool_name>.py`
   - Signature: `async def handle_<tool_name>(args: dict) -> dict`

4. **Server routes** → `legal_mcp/server/__init__.py`
   - HTTP endpoints
   - Route registration function

5. **Tests** → `tests/`
   - Mirror the source structure
   - Prefix test files: `test_*.py` or `*_test.py`

## Adding a New MCP Tool

1. **Create the tool module**:
   ```bash
   # legal_mcp/tools/my_tool.py
   async def handle_my_tool(args: dict) -> dict:
       """Handle my_tool MCP tool."""
       # Implementation
       return {"result": "..."}
   ```

2. **Register in server** (add to `legal_mcp/server/__init__.py`):
   ```python
   @server.post("/api/my-tool")  # HTTP endpoint
   async def my_tool_endpoint(data: dict):
       """Endpoint for my_tool."""
       from legal_mcp.tools.my_tool import handle_my_tool
       result = await handle_my_tool(data)
       return result
   ```

3. **Add tests**:
   ```bash
   # tests/test_tools_my_tool.py
   ```

## Commit Messages

Use clear, descriptive commit messages:
- **fix**: Bug fixes
- **feat**: New features
- **refactor**: Code restructuring without behavior changes
- **docs**: Documentation updates
- **test**: Test additions or fixes
- **chore**: Maintenance, dependency updates

Example:
```
feat: add legal_research tool with Ollama integration

- Add handle_legal_research function in tools/legal_research.py
- Integrate with Ollama backend for LLM queries
- Add route /api/legal-research to server
- Add tests for legal research tool
```

## Testing

Write tests for new features:
```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_tools_my_tool.py -v

# Run with coverage
pytest tests/ --cov=legal_mcp
```

## Before Submitting a PR

- [ ] Code is formatted (`make format`)
- [ ] Code passes linters (`make lint`)
- [ ] Tests pass (`make test`)
- [ ] New tests added for new functionality
- [ ] Documentation updated if needed
- [ ] No breaking changes to existing APIs (unless intentional)

## Questions?

Check `ARCHITECTURE.md` for project structure details or open an issue.
