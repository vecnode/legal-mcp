.PHONY: help format lint test install dev-install clean

help:
	@echo "legal-mcp development commands:"
	@echo "  make format       - Format code with black and ruff"
	@echo "  make lint         - Run ruff linter"
	@echo "  make test         - Run tests with pytest"
	@echo "  make install      - Install package in editable mode"
	@echo "  make dev-install  - Install package with dev dependencies"
	@echo "  make clean        - Remove build artifacts"

format:
	black legal_mcp tests
	ruff format legal_mcp tests

lint:
	ruff check legal_mcp tests

test:
	pytest tests/ -v

install:
	pip install -e .

dev-install:
	pip install -e ".[dev]"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf build/ dist/

.DEFAULT_GOAL := help
