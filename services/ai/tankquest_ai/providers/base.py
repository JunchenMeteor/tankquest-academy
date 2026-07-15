from typing import Protocol

from ..models import (
    AdaptivePracticeRecommendationPayload,
    AdaptivePracticeRecommendationRequest,
    QuestionDraftPayload,
    QuestionDraftRequest,
    WrongAnswerExplanationPayload,
    WrongAnswerExplanationRequest,
)


class QuestionDraftProvider(Protocol):
    def generate(self, request: QuestionDraftRequest) -> QuestionDraftPayload: ...


class WrongAnswerExplanationProvider(Protocol):
    def generate(self, request: WrongAnswerExplanationRequest) -> WrongAnswerExplanationPayload: ...


class AdaptivePracticeRecommendationProvider(Protocol):
    def generate(
        self, request: AdaptivePracticeRecommendationRequest
    ) -> AdaptivePracticeRecommendationPayload: ...
