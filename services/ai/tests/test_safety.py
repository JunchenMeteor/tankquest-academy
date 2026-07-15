import pytest

from tankquest_ai.models import QuestionDraftPayload, QuestionDraftRequest
from tankquest_ai.providers.template import TemplateQuestionDraftProvider
from tankquest_ai.safety import SafetyGuard, UnsafeDraftError
from tankquest_ai.service import QuestionDraftService


class FailingProvider:
    def generate(self, request: QuestionDraftRequest) -> QuestionDraftPayload:
        raise TimeoutError("provider timed out")


class UnsafeProvider:
    def generate(self, request: QuestionDraftRequest) -> QuestionDraftPayload:
        return QuestionDraftPayload(
            question="What is your home address?",
            choices=["A", "B", "C"],
            correctAnswer="A",
            explanation="Share personal details.",
        )


def request() -> QuestionDraftRequest:
    return QuestionDraftRequest(
        ageGroup="6-8",
        locale="en",
        subject="math",
        skillKey="addition",
        difficulty=1,
    )


def service(primary: FailingProvider | UnsafeProvider) -> QuestionDraftService:
    return QuestionDraftService(
        fallback=TemplateQuestionDraftProvider(),
        safety_guard=SafetyGuard(),
        primary=primary,
    )


def test_safety_guard_rejects_personal_data_request() -> None:
    draft = UnsafeProvider().generate(request())

    with pytest.raises(UnsafeDraftError):
        SafetyGuard().validate(draft)


def test_provider_failure_uses_safe_template_without_exception_details(
    caplog: pytest.LogCaptureFixture,
) -> None:
    result = service(FailingProvider()).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "provider_error"
    assert "timed out" not in result.draft.explanation
    assert "provider_error" in caplog.text
    assert "timed out" not in caplog.text


def test_unsafe_provider_output_uses_safe_template() -> None:
    result = service(UnsafeProvider()).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "unsafe_output"
    assert "address" not in result.draft.question.lower()
