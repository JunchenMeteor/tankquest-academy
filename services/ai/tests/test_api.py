from fastapi.testclient import TestClient

from tankquest_ai.main import create_app
from tankquest_ai.settings import ProviderName, Settings


def settings(provider: ProviderName = "template") -> Settings:
    return Settings(
        provider=provider,
        model=None,
        openai_api_key=None,
        provider_timeout_seconds=8,
    )


def test_health_uses_template_without_credentials() -> None:
    response = TestClient(create_app(settings=settings())).get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "requestedProvider": "template",
        "effectiveProvider": "template",
    }


def test_openai_configuration_degrades_without_exposing_secrets() -> None:
    response = TestClient(create_app(settings=settings("openai"))).get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "degraded",
        "requestedProvider": "openai",
        "effectiveProvider": "template",
    }


def test_question_draft_contract_and_fallback_metadata() -> None:
    response = TestClient(create_app(settings=settings())).post(
        "/v1/internal/question-drafts",
        json={
            "ageGroup": "6-8",
            "locale": "en",
            "subject": "math",
            "skillKey": "addition",
            "difficulty": 2,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "template"
    assert body["fallbackReason"] is None
    assert body["draft"]["correctAnswer"] in body["draft"]["choices"]
    assert len(body["draft"]["choices"]) == 3
    assert body["requestId"]


def test_question_draft_rejects_extra_personal_data() -> None:
    response = TestClient(create_app(settings=settings())).post(
        "/v1/internal/question-drafts",
        json={
            "ageGroup": "6-8",
            "locale": "en",
            "subject": "math",
            "skillKey": "addition",
            "difficulty": 2,
            "childName": "not-allowed",
        },
    )

    assert response.status_code == 422
