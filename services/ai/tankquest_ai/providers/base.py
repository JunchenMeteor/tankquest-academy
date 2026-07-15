from typing import Protocol

from ..models import (
    AdaptivePracticeRecommendationPayload,
    AdaptivePracticeRecommendationRequest,
    ParentReportSummaryPayload,
    ParentReportSummaryRequest,
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


class ParentReportSummaryProvider(Protocol):
    def generate(self, request: ParentReportSummaryRequest) -> ParentReportSummaryPayload: ...
