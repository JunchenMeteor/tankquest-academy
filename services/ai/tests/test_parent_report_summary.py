from typing import cast

import pytest
from fastapi.testclient import TestClient

from tankquest_ai.main import create_app
from tankquest_ai.models import ParentReportSummaryPayload, ParentReportSummaryRequest
from tankquest_ai.providers.template import TemplateParentReportSummaryProvider
from tankquest_ai.safety import SafetyGuard
from tankquest_ai.service import ParentReportSummaryService
from tankquest_ai.settings import Settings


class StaticProvider:
    def __init__(self, payload: ParentReportSummaryPayload) -> None:
        self._payload = payload

    def generate(self, request: ParentReportSummaryRequest) -> ParentReportSummaryPayload:
        return self._payload


class InvalidProvider:
    def generate(self, request: ParentReportSummaryRequest) -> ParentReportSummaryPayload:
        return cast(ParentReportSummaryPayload, {"progress": "missing required fields"})


class FailingProvider:
    def generate(self, request: ParentReportSummaryRequest) -> ParentReportSummaryPayload:
        raise TimeoutError("secret provider timeout")


def request(**overrides: object) -> ParentReportSummaryRequest:
    values: dict[str, object] = {
        "locale": "en",
        "completedSessions": 4,
        "totalAnswers": 12,
        "subjects": [
            {
                "subject": "math",
                "attempts": 12,
                "accuracy": 75,
                "averageAnswerTimeMs": 9_000,
            }
        ],
        "skills": [
            {
                "subject": "math",
                "skillKey": "addition-within-20",
                "attempts": 7,
                "accuracy": 86,
                "averageAnswerTimeMs": 8_000,
                "currentDifficulty": 2,
                "trend": "improving",
            },
            {
                "subject": "math",
                "skillKey": "subtraction-within-20",
                "attempts": 5,
                "accuracy": 60,
                "averageAnswerTimeMs": 10_400,
                "currentDifficulty": 2,
                "trend": "needs-practice",
            },
        ],
    }
    values.update(overrides)
    return ParentReportSummaryRequest.model_validate(values)


def service(
    primary: StaticProvider | InvalidProvider | FailingProvider,
) -> ParentReportSummaryService:
    return ParentReportSummaryService(
        fallback=TemplateParentReportSummaryProvider(),
        safety_guard=SafetyGuard(),
        primary=primary,
    )


def test_template_summary_is_localized_and_uses_only_backend_trend_signals() -> None:
    english = TemplateParentReportSummaryProvider().generate(request())
    chinese = TemplateParentReportSummaryProvider().generate(request(locale="zh-CN"))

    assert "addition within 20" in english.progress
    assert "subtraction within 20" in english.attention
    assert "进步信号" in chinese.progress
    assert "继续练习" in chinese.attention


def test_template_does_not_claim_progress_without_an_improving_signal() -> None:
    result = TemplateParentReportSummaryProvider().generate(
        request(
            skills=[
                {
                    "subject": "math",
                    "skillKey": "addition-within-20",
                    "attempts": 2,
                    "accuracy": 75,
                    "averageAnswerTimeMs": 9_000,
                    "trend": "insufficient-data",
                }
            ]
        )
    )

    assert "not enough evidence" in result.progress


def test_safe_model_summary_is_returned_as_model_output() -> None:
    payload = ParentReportSummaryPayload(
        practiceContent="Practiced math across four sessions.",
        progress="Addition has an improving signal.",
        attention="Subtraction may benefit from more practice.",
        nextStep="Use a short subtraction practice next.",
    )

    result = service(StaticProvider(payload)).generate(request())

    assert result.source == "model"
    assert result.fallback_reason is None
    assert result.payload == payload


@pytest.mark.parametrize(
    "unsafe_text",
    [
        "The child is lazy and falling behind.",
        "This result suggests an anxiety diagnosis.",
        "The child has ADHD and is a slow learner.",
        "The child is autistic and brilliant.",
        "Practice was steady. Keep going.",
        "Visit https://example.com for urgent intervention.",
        "Please provide the child's email address.",
        "孩子能力差，必须立即干预。",
    ],
)
def test_unsafe_model_summary_uses_safe_template(unsafe_text: str) -> None:
    primary = StaticProvider(
        ParentReportSummaryPayload(
            practiceContent="Practiced math.",
            progress="There is not enough evidence yet.",
            attention=unsafe_text,
            nextStep="Continue with short practice.",
        )
    )

    result = service(primary).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "unsafe_output"
    assert unsafe_text not in result.payload.attention


def test_invalid_model_summary_uses_safe_template() -> None:
    result = service(InvalidProvider()).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "invalid_output"
    assert result.payload.practice_content


def test_provider_failure_uses_safe_template_without_exception_details(
    caplog: pytest.LogCaptureFixture,
) -> None:
    result = service(FailingProvider()).generate(request())

    assert result.source == "template"
    assert result.fallback_reason == "provider_error"
    assert "provider_error" in caplog.text
    assert "secret provider timeout" not in caplog.text


def test_parent_report_summary_endpoint_returns_four_structured_sections() -> None:
    settings = Settings(
        provider="template",
        model=None,
        openai_api_key=None,
        provider_timeout_seconds=8,
    )
    response = TestClient(create_app(settings=settings)).post(
        "/v1/internal/parent-report-summaries",
        json=request().model_dump(by_alias=True),
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "requestId": body["requestId"],
        "source": "template",
        "fallbackReason": None,
        "summary": {
            "practiceContent": body["summary"]["practiceContent"],
            "progress": body["summary"]["progress"],
            "attention": body["summary"]["attention"],
            "nextStep": body["summary"]["nextStep"],
        },
    }
    assert all(body["summary"].values())


@pytest.mark.parametrize(
    ("path", "value"),
    [
        (("childId",), "child_001"),
        (("childName",), "Private Name"),
        (("rawAnswers",), [{"selectedAnswer": "12"}]),
        (("subjects", 0, "correctAnswer"), "15"),
        (("skills", 0, "sessionId"), "session_001"),
    ],
)
def test_parent_report_summary_endpoint_rejects_non_aggregate_fields(
    path: tuple[str | int, ...], value: object
) -> None:
    payload = request().model_dump(by_alias=True)
    target: object = payload
    for part in path[:-1]:
        target = cast(dict[str, object] | list[object], target)[part]
    cast(dict[str, object], target)[cast(str, path[-1])] = value
    settings = Settings(
        provider="template",
        model=None,
        openai_api_key=None,
        provider_timeout_seconds=8,
    )

    response = TestClient(create_app(settings=settings)).post(
        "/v1/internal/parent-report-summaries",
        json=payload,
    )

    assert response.status_code == 422
