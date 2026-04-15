"""
Domain models and business logic for legal document analysis.

This layer contains core data structures and domain-specific logic
that is independent of external frameworks and dependencies.
"""

from .context import LegalContext
from .legal_research import LegalResearchRequest, LegalResearchResult

__all__ = [
	"LegalContext",
	"LegalResearchRequest",
	"LegalResearchResult",
]
