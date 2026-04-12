.PHONY: help format lint test install clean

help:
	@echo "legal-mcp development commands (using uv):"
	@echo "  make format       - Format code with black and ruff"
	@echo "  make lint         - Run ruff linter"
	@echo "  make test         - Run tests with pytest"
	@echo "  make install      - Install package in editable mode"
	@echo "  make clean        - Remove build artifacts"
	@echo ""
	@echo "Or use uv directly:"
	@echo "  uv sync"
	@echo "  uv run black legal_mcp tests"
	@echo "  uv run ruff check legal_mcp tests"
	@echo "  uv run pytest tests/"

format:
	uv run black legal_mcp tests
	uv run ruff format legal_mcp tests

lint:
	uv run ruff check legal_mcp tests

test:
	uv run pytest tests/ -v

install:
	uv sync

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf build/ dist/

.DEFAULT_GOAL := help
