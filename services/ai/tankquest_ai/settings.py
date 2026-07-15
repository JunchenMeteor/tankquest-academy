import os
from dataclasses import dataclass
from typing import Literal, cast

ProviderName = Literal["template", "openai"]


@dataclass(frozen=True)
class Settings:
    provider: ProviderName
    model: str | None
    openai_api_key: str | None
    provider_timeout_seconds: float

    @classmethod
    def from_environment(cls) -> "Settings":
        provider_value = os.getenv("AI_PROVIDER", "template").lower()
        if provider_value not in {"template", "openai"}:
            raise ValueError("AI_PROVIDER must be template or openai")

        timeout = float(os.getenv("AI_PROVIDER_TIMEOUT_SECONDS", "8"))
        if timeout <= 0 or timeout > 30:
            raise ValueError("AI_PROVIDER_TIMEOUT_SECONDS must be between 0 and 30")

        return cls(
            provider=cast(ProviderName, provider_value),
            model=os.getenv("AI_MODEL") or None,
            openai_api_key=os.getenv("OPENAI_API_KEY") or None,
            provider_timeout_seconds=timeout,
        )
