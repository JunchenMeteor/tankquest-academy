from tankquest_ai.models import (
    WrongAnswerExplanationPayload,
    WrongAnswerExplanationRequest,
)
from tankquest_ai.providers.template import TemplateWrongAnswerExplanationProvider
from tankquest_ai.safety import SafetyGuard
from tankquest_ai.service import WrongAnswerExplanationService


class MismatchedProvider:
    def generate(self, request: WrongAnswerExplanationRequest) -> WrongAnswerExplanationPayload:
        return WrongAnswerExplanationPayload(
            correctAnswer="12",
            explanation="The answer is 12.",
        )


class UnsafeExplanationProvider:
    def generate(self, request: WrongAnswerExplanationRequest) -> WrongAnswerExplanationPayload:
        return WrongAnswerExplanationPayload(
            correctAnswer=request.correct_answer,
            explanation="That was a stupid answer.",
        )


class LongExplanationProvider:
    def generate(self, request: WrongAnswerExplanationRequest) -> WrongAnswerExplanationPayload:
        return WrongAnswerExplanationPayload(
            correctAnswer=request.correct_answer,
            explanation="First step. Second step. Third step.",
        )


def request() -> WrongAnswerExplanationRequest:
    return WrongAnswerExplanationRequest(
        ageGroup="6-8",
        locale="en",
        subject="math",
        skillKey="addition-within-20",
        difficulty=1,
        question="8 + 7 = ?",
        selectedAnswer="12",
        correctAnswer="15",
    )


def service(
    primary: MismatchedProvider | UnsafeExplanationProvider | LongExplanationProvider,
) -> WrongAnswerExplanationService:
    return WrongAnswerExplanationService(
        fallback=TemplateWrongAnswerExplanationProvider(),
        safety_guard=SafetyGuard(),
        primary=primary,
    )


def test_correct_answer_mismatch_uses_the_authoritative_template() -> None:
    result = service(MismatchedProvider()).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "invalid_output"
    assert result.payload.correct_answer == "15"
    assert "12" not in result.payload.explanation


def test_unsafe_explanation_uses_the_safe_template() -> None:
    result = service(UnsafeExplanationProvider()).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "unsafe_output"
    assert "stupid" not in result.payload.explanation.lower()


def test_more_than_two_sentences_uses_the_safe_template() -> None:
    result = service(LongExplanationProvider()).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "unsafe_output"
    assert "Third step" not in result.payload.explanation
