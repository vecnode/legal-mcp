"""Module entry point for running the legal-mcp server.

This allows the server to be started with:
    python -m legal_mcp.server
"""

import sys
import uvicorn

from . import app


def main() -> int:
    """Run the MCP server with uvicorn.
    
    Returns:
        int: Exit code (0 for success)
    """
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8080,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
