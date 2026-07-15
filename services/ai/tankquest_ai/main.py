from typing import cast
from uuid import uuid4

from fastapi import FastAPI, Request

from .models import (
    HealthResponse,
    QuestionDraftRequest,
    QuestionDraftResponse,
    WrongAnswerExplanationRequest,
    WrongAnswerExplanationResponse,
)
from .service import (
    QuestionDraftService,
    WrongAnswerExplanationService,
    build_question_draft_service,
    build_wrong_answer_explanation_service,
    health_response,
)
from .settings import Settings


def create_app(
    *,
    settings: Settings | None = None,
    draft_service: QuestionDraftService | None = None,
    explanation_service: WrongAnswerExplanationService | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings.from_environment()
    resolved_draft_service = draft_service or build_question_draft_service(resolved_settings)
    resolved_explanation_service = explanation_service or build_wrong_answer_explanation_service(
        resolved_settings
    )

    app = FastAPI(title="TankQuest AI", version="0.1.0", docs_url=None, redoc_url=None)
    app.state.settings = resolved_settings
    app.state.draft_service = resolved_draft_service
    app.state.explanation_service = resolved_explanation_service

    @app.get("/health", response_model=HealthResponse, response_model_by_alias=True)
    def health(request: Request) -> HealthResponse:
        current_settings = cast(Settings, request.app.state.settings)
        current_draft_service = cast(QuestionDraftService, request.app.state.draft_service)
        current_explanation_service = cast(
            WrongAnswerExplanationService, request.app.state.explanation_service
        )
        return health_response(
            current_settings,
            current_draft_service,
            current_explanation_service,
        )

    @app.post(
        "/v1/internal/question-drafts",
        response_model=QuestionDraftResponse,
        response_model_by_alias=True,
    )
    def create_question_draft(
        payload: QuestionDraftRequest, request: Request
    ) -> QuestionDraftResponse:
        service = cast(QuestionDraftService, request.app.state.draft_service)
        result = service.generate(payload)
        return QuestionDraftResponse(
            requestId=str(uuid4()),
            source=result.source,
            fallbackReason=result.fallback_reason,
            draft=result.draft,
        )

    @app.post(
        "/v1/internal/wrong-answer-explanations",
        response_model=WrongAnswerExplanationResponse,
        response_model_by_alias=True,
    )
    def create_wrong_answer_explanation(
        payload: WrongAnswerExplanationRequest, request: Request
    ) -> WrongAnswerExplanationResponse:
        service = cast(WrongAnswerExplanationService, request.app.state.explanation_service)
        result = service.generate(payload)
        return WrongAnswerExplanationResponse(
            requestId=str(uuid4()),
            source=result.source,
            fallbackReason=result.fallback_reason,
            correctAnswer=result.payload.correct_answer,
            explanation=result.payload.explanation,
        )

    return app


app = create_app()
