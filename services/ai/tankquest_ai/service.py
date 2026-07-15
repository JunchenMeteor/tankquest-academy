import logging
from dataclasses import dataclass

from .models import (
    DraftSource,
    FallbackReason,
    HealthResponse,
    QuestionDraftPayload,
    QuestionDraftRequest,
)
from .providers.base import QuestionDraftProvider
from .providers.langchain_openai import LangChainOpenAIQuestionDraftProvider
from .providers.template import TemplateQuestionDraftProvider
from .safety import SafetyGuard, UnsafeDraftError
from .settings import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DraftResult:
    draft: QuestionDraftPayload
    source: DraftSource
    fallback_reason: FallbackReason | None = None


class QuestionDraftService:
    def __init__(
        self,
        *,
        fallback: QuestionDraftProvider,
        safety_guard: SafetyGuard,
        primary: QuestionDraftProvider | None = None,
        unavailable_reason: FallbackReason | None = None,
    ) -> None:
        self._fallback = fallback
        self._safety_guard = safety_guard
        self._primary = primary
        self._unavailable_reason = unavailable_reason

    @property
    def uses_primary_provider(self) -> bool:
        return self._primary is not None

    def generate(self, request: QuestionDraftRequest) -> DraftResult:
        if self._primary is None:
            draft = self._safe_fallback(request)
            return DraftResult(
                draft=draft,
                source="template",
                fallback_reason=self._unavailable_reason,
            )

        try:
            draft = self._primary.generate(request)
            self._safety_guard.validate(draft)
            return DraftResult(draft=draft, source="model")
        except UnsafeDraftError:
            logger.warning("ai_provider_fallback reason=unsafe_output")
            return DraftResult(
                draft=self._safe_fallback(request),
                source="template",
                fallback_reason="unsafe_output",
            )
        except Exception:
            logger.warning("ai_provider_fallback reason=provider_error")
            return DraftResult(
                draft=self._safe_fallback(request),
                source="template",
                fallback_reason="provider_error",
            )

    def _safe_fallback(self, request: QuestionDraftRequest) -> QuestionDraftPayload:
        draft = self._fallback.generate(request)
        self._safety_guard.validate(draft)
        return draft


def build_question_draft_service(settings: Settings) -> QuestionDraftService:
    fallback = TemplateQuestionDraftProvider()
    safety_guard = SafetyGuard()

    if settings.provider == "template":
        return QuestionDraftService(fallback=fallback, safety_guard=safety_guard)

    if not settings.openai_api_key or not settings.model:
        logger.warning("ai_provider_unavailable reason=config_missing")
        return QuestionDraftService(
            fallback=fallback,
            safety_guard=safety_guard,
            unavailable_reason="config_missing",
        )

    try:
        primary = LangChainOpenAIQuestionDraftProvider(
            api_key=settings.openai_api_key,
            model=settings.model,
            timeout_seconds=settings.provider_timeout_seconds,
        )
    except Exception:
        logger.warning("ai_provider_unavailable reason=provider_error")
        return QuestionDraftService(
            fallback=fallback,
            safety_guard=safety_guard,
            unavailable_reason="provider_error",
        )
    return QuestionDraftService(fallback=fallback, safety_guard=safety_guard, primary=primary)


def health_response(settings: Settings, service: QuestionDraftService) -> HealthResponse:
    if settings.provider == "openai" and not service.uses_primary_provider:
        return HealthResponse(
            status="degraded",
            requestedProvider=settings.provider,
            effectiveProvider="template",
        )
    return HealthResponse(
        status="ok",
        requestedProvider=settings.provider,
        effectiveProvider="model" if service.uses_primary_provider else "template",
    )
