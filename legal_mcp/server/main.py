"""Main entry point for legal-mcp server CLI."""

import sys
import uvicorn


def main() -> int:
    """Run the MCP server with uvicorn.
    
    This is the entry point for the console_scripts in pyproject.toml.
    It allows the server to be started with:
        legal-mcp-server
    
    Returns:
        int: Exit code (0 for success)
    """
    from legal_mcp.server import app

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8080,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
