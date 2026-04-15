"""Domain models for the legal_research tool."""

from dataclasses import dataclass


@dataclass(frozen=True)
class LegalResearchRequest:
    """Input contract for legal research calls."""

    query: str
    country: str
    domain: str
    limit: int = 5


@dataclass(frozen=True)
class LegalResearchResult:
    """Single legal research result."""

    title: str
    source: str
    summary: str

    def to_dict(self) -> dict:
        """Serialize result as JSON-ready dict."""
        return {
            "title": self.title,
            "source": self.source,
            "summary": self.summary,
        }
