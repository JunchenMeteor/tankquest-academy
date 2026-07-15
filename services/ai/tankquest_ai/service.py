import logging
from dataclasses import dataclass

from .models import (
    AdaptivePracticeRecommendationPayload,
    AdaptivePracticeRecommendationRequest,
    DraftSource,
    FallbackReason,
    HealthResponse,
    QuestionDraftPayload,
    QuestionDraftRequest,
    WrongAnswerExplanationPayload,
    WrongAnswerExplanationRequest,
)
from .providers.base import (
    AdaptivePracticeRecommendationProvider,
    QuestionDraftProvider,
    WrongAnswerExplanationProvider,
)
from .providers.langchain_openai import (
    LangChainOpenAIAdaptivePracticeRecommendationProvider,
    LangChainOpenAIQuestionDraftProvider,
    LangChainOpenAIWrongAnswerExplanationProvider,
)
from .providers.template import (
    TemplateAdaptivePracticeRecommendationProvider,
    TemplateQuestionDraftProvider,
    TemplateWrongAnswerExplanationProvider,
)
from .safety import SafetyGuard, UnsafeDraftError
from .settings import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DraftResult:
    draft: QuestionDraftPayload
    source: DraftSource
    fallback_reason: FallbackReason | None = None


@dataclass(frozen=True)
class ExplanationResult:
    payload: WrongAnswerExplanationPayload
    source: DraftSource
    fallback_reason: FallbackReason | None = None


@dataclass(frozen=True)
class AdaptivePracticeRecommendationResult:
    payload: AdaptivePracticeRecommendationPayload
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


class WrongAnswerExplanationService:
    def __init__(
        self,
        *,
        fallback: WrongAnswerExplanationProvider,
        safety_guard: SafetyGuard,
        primary: WrongAnswerExplanationProvider | None = None,
        unavailable_reason: FallbackReason | None = None,
    ) -> None:
        self._fallback = fallback
        self._safety_guard = safety_guard
        self._primary = primary
        self._unavailable_reason = unavailable_reason

    @property
    def uses_primary_provider(self) -> bool:
        return self._primary is not None

    def generate(self, request: WrongAnswerExplanationRequest) -> ExplanationResult:
        if self._primary is None:
            return ExplanationResult(
                payload=self._safe_fallback(request),
                source="template",
                fallback_reason=self._unavailable_reason,
            )

        try:
            payload = self._primary.generate(request)
            if payload.correct_answer != request.correct_answer:
                logger.warning("ai_provider_fallback reason=invalid_output")
                return ExplanationResult(
                    payload=self._safe_fallback(request),
                    source="template",
                    fallback_reason="invalid_output",
                )
            self._safety_guard.validate_explanation(payload)
            return ExplanationResult(payload=payload, source="model")
        except UnsafeDraftError:
            logger.warning("ai_provider_fallback reason=unsafe_output")
            return ExplanationResult(
                payload=self._safe_fallback(request),
                source="template",
                fallback_reason="unsafe_output",
            )
        except Exception:
            logger.warning("ai_provider_fallback reason=provider_error")
            return ExplanationResult(
                payload=self._safe_fallback(request),
                source="template",
                fallback_reason="provider_error",
            )

    def _safe_fallback(
        self, request: WrongAnswerExplanationRequest
    ) -> WrongAnswerExplanationPayload:
        payload = self._fallback.generate(request)
        self._safety_guard.validate_explanation(payload)
        return payload


class AdaptivePracticeRecommendationService:
    def __init__(
        self,
        *,
        fallback: AdaptivePracticeRecommendationProvider,
        primary: AdaptivePracticeRecommendationProvider | None = None,
        unavailable_reason: FallbackReason | None = None,
    ) -> None:
        self._fallback = fallback
        self._primary = primary
        self._unavailable_reason = unavailable_reason

    @property
    def uses_primary_provider(self) -> bool:
        return self._primary is not None

    def generate(
        self, request: AdaptivePracticeRecommendationRequest
    ) -> AdaptivePracticeRecommendationResult:
        if self._primary is None:
            return AdaptivePracticeRecommendationResult(
                payload=self._fallback.generate(request),
                source="template",
                fallback_reason=self._unavailable_reason,
            )

        try:
            payload = self._primary.generate(request)
            if not self._is_valid_for_request(payload, request):
                logger.warning("ai_provider_fallback reason=invalid_output")
                return AdaptivePracticeRecommendationResult(
                    payload=self._fallback.generate(request),
                    source="template",
                    fallback_reason="invalid_output",
                )
            return AdaptivePracticeRecommendationResult(payload=payload, source="model")
        except Exception:
            logger.warning("ai_provider_fallback reason=provider_error")
            return AdaptivePracticeRecommendationResult(
                payload=self._fallback.generate(request),
                source="template",
                fallback_reason="provider_error",
            )

    @staticmethod
    def _is_valid_for_request(
        payload: AdaptivePracticeRecommendationPayload,
        request: AdaptivePracticeRecommendationRequest,
    ) -> bool:
        allowed = request.allowed_difficulty
        return (
            payload.subject == request.subject
            and payload.skill_key == request.skill_key
            and allowed.minimum <= payload.recommended_difficulty <= allowed.maximum
        )


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


def build_wrong_answer_explanation_service(
    settings: Settings,
) -> WrongAnswerExplanationService:
    fallback = TemplateWrongAnswerExplanationProvider()
    safety_guard = SafetyGuard()

    if settings.provider == "template":
        return WrongAnswerExplanationService(fallback=fallback, safety_guard=safety_guard)

    if not settings.openai_api_key or not settings.model:
        logger.warning("ai_provider_unavailable reason=config_missing")
        return WrongAnswerExplanationService(
            fallback=fallback,
            safety_guard=safety_guard,
            unavailable_reason="config_missing",
        )

    try:
        primary = LangChainOpenAIWrongAnswerExplanationProvider(
            api_key=settings.openai_api_key,
            model=settings.model,
            timeout_seconds=settings.provider_timeout_seconds,
        )
    except Exception:
        logger.warning("ai_provider_unavailable reason=provider_error")
        return WrongAnswerExplanationService(
            fallback=fallback,
            safety_guard=safety_guard,
            unavailable_reason="provider_error",
        )
    return WrongAnswerExplanationService(
        fallback=fallback,
        safety_guard=safety_guard,
        primary=primary,
    )


def build_adaptive_practice_recommendation_service(
    settings: Settings,
) -> AdaptivePracticeRecommendationService:
    fallback = TemplateAdaptivePracticeRecommendationProvider()

    if settings.provider == "template":
        return AdaptivePracticeRecommendationService(fallback=fallback)

    if not settings.openai_api_key or not settings.model:
        logger.warning("ai_provider_unavailable reason=config_missing")
        return AdaptivePracticeRecommendationService(
            fallback=fallback,
            unavailable_reason="config_missing",
        )

    try:
        primary = LangChainOpenAIAdaptivePracticeRecommendationProvider(
            api_key=settings.openai_api_key,
            model=settings.model,
            timeout_seconds=settings.provider_timeout_seconds,
        )
    except Exception:
        logger.warning("ai_provider_unavailable reason=provider_error")
        return AdaptivePracticeRecommendationService(
            fallback=fallback,
            unavailable_reason="provider_error",
        )
    return AdaptivePracticeRecommendationService(fallback=fallback, primary=primary)


def health_response(
    settings: Settings,
    service: QuestionDraftService,
    explanation_service: WrongAnswerExplanationService | None = None,
    recommendation_service: AdaptivePracticeRecommendationService | None = None,
) -> HealthResponse:
    if settings.provider == "openai" and (
        not service.uses_primary_provider
        or (explanation_service is not None and not explanation_service.uses_primary_provider)
        or (recommendation_service is not None and not recommendation_service.uses_primary_provider)
    ):
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
