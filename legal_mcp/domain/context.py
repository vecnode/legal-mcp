"""Domain model for shared legal context metadata."""

from dataclasses import dataclass
from typing import Mapping

VALID_COUNTRIES = {"US", "EU", "DE", "PT", "UK", "BR"}
VALID_DOMAINS = {
    "general",
    "contract",
    "employment",
    "tax",
    "data_protection",
    "ip",
}


@dataclass(frozen=True)
class LegalContext:
    """Context propagated through legal tools."""

    country: str = "EU"
    domain: str = "general"

    @classmethod
    def from_args(cls, args: Mapping[str, object]) -> "LegalContext":
        """Build context from user/tool arguments with safe defaults."""
        raw_country = str(args.get("country", "EU")).strip().upper()
        raw_domain = str(args.get("domain", "general")).strip().lower()

        country = raw_country if raw_country in VALID_COUNTRIES else "EU"
        domain = raw_domain if raw_domain in VALID_DOMAINS else "general"
        return cls(country=country, domain=domain)

    def to_dict(self) -> dict:
        """Serialize context for JSON responses."""
        return {"country": self.country, "domain": self.domain}
