# legal-mcp

A Legal-MCP framework (ongoing).

### Reproduce

```sh
uv sync
uv run uvicorn app:app --host 127.0.0.1 --port 8080 --reload
```

### Libraries

- Dependencies are listed in `pyproject.toml` (`[project].dependencies`). 
- After cloning, `uv sync` installs exactly what `uv.lock` pins.

