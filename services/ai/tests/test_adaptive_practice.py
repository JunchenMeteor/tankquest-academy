import pytest

from tankquest_ai.models import (
    AdaptivePracticeRecommendationPayload,
    AdaptivePracticeRecommendationRequest,
    Subject,
)
from tankquest_ai.providers.template import TemplateAdaptivePracticeRecommendationProvider
from tankquest_ai.service import AdaptivePracticeRecommendationService


class StaticProvider:
    def __init__(self, payload: AdaptivePracticeRecommendationPayload) -> None:
        self._payload = payload

    def generate(
        self, request: AdaptivePracticeRecommendationRequest
    ) -> AdaptivePracticeRecommendationPayload:
        return self._payload


class FailingProvider:
    def generate(
        self, request: AdaptivePracticeRecommendationRequest
    ) -> AdaptivePracticeRecommendationPayload:
        raise TimeoutError("provider timed out")


def request(**overrides: object) -> AdaptivePracticeRecommendationRequest:
    values: dict[str, object] = {
        "ageGroup": "6-8",
        "subject": "math",
        "skillKey": "addition-within-20",
        "currentDifficulty": 3,
        "attempts": 10,
        "accuracy": 90,
        "averageAnswerTimeMs": 12_000,
        "completedSessions": 3,
        "allowedDifficulty": {"min": 2, "max": 4},
    }
    values.update(overrides)
    return AdaptivePracticeRecommendationRequest.model_validate(values)


def service(
    primary: StaticProvider | FailingProvider,
) -> AdaptivePracticeRecommendationService:
    return AdaptivePracticeRecommendationService(
        fallback=TemplateAdaptivePracticeRecommendationProvider(),
        primary=primary,
    )


@pytest.mark.parametrize(
    ("overrides", "expected_difficulty", "expected_intent"),
    [
        ({}, 4, "challenge"),
        ({"accuracy": 55}, 2, "review"),
        ({"accuracy": 75}, 3, "reinforce"),
        ({"attempts": 2}, 3, "reinforce"),
        ({"currentDifficulty": 4}, 4, "challenge"),
    ],
)
def test_template_recommendation_is_deterministic_and_bounded(
    overrides: dict[str, object], expected_difficulty: int, expected_intent: str
) -> None:
    result = TemplateAdaptivePracticeRecommendationProvider().generate(request(**overrides))

    assert result.subject == "math"
    assert result.skill_key == "addition-within-20"
    assert result.recommended_difficulty == expected_difficulty
    assert result.practice_intent == expected_intent


@pytest.mark.parametrize(
    ("subject", "skill_key", "difficulty"),
    [
        ("english", "addition-within-20", 3),
        ("math", "subtraction-within-20", 3),
        ("math", "addition-within-20", 5),
    ],
)
def test_provider_mismatch_or_out_of_range_uses_invalid_output_fallback(
    subject: Subject, skill_key: str, difficulty: int
) -> None:
    primary = StaticProvider(
        AdaptivePracticeRecommendationPayload(
            subject=subject,
            skillKey=skill_key,
            recommendedDifficulty=difficulty,
            practiceIntent="reinforce",
        )
    )

    result = service(primary).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "invalid_output"
    assert result.payload.subject == "math"
    assert result.payload.skill_key == "addition-within-20"
    assert 2 <= result.payload.recommended_difficulty <= 4


def test_provider_failure_uses_deterministic_fallback_without_exception_details(
    caplog: pytest.LogCaptureFixture,
) -> None:
    result = service(FailingProvider()).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "provider_error"
    assert result.payload.recommended_difficulty == 4
    assert "provider_error" in caplog.text
    assert "timed out" not in caplog.text
