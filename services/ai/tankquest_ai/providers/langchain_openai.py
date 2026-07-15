from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

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
from ..prompts import (
    ADAPTIVE_PRACTICE_SYSTEM_PROMPT,
    PARENT_REPORT_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    WRONG_ANSWER_SYSTEM_PROMPT,
    adaptive_practice_recommendation_prompt,
    parent_report_summary_prompt,
    question_draft_prompt,
    wrong_answer_explanation_prompt,
)


class LangChainOpenAIQuestionDraftProvider:
    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        chat_model = ChatOpenAI(
            api_key=SecretStr(api_key),
            model=model,
            temperature=0,
            timeout=timeout_seconds,
            max_retries=0,
        )
        self._structured_model = chat_model.with_structured_output(
            QuestionDraftPayload,
            method="json_schema",
            strict=True,
        )

    def generate(self, request: QuestionDraftRequest) -> QuestionDraftPayload:
        result = self._structured_model.invoke(
            [SystemMessage(SYSTEM_PROMPT), HumanMessage(question_draft_prompt(request))]
        )
        if isinstance(result, QuestionDraftPayload):
            return result
        return QuestionDraftPayload.model_validate(result)


class LangChainOpenAIWrongAnswerExplanationProvider:
    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        chat_model = ChatOpenAI(
            api_key=SecretStr(api_key),
            model=model,
            temperature=0,
            timeout=timeout_seconds,
            max_retries=0,
        )
        self._structured_model = chat_model.with_structured_output(
            WrongAnswerExplanationPayload,
            method="json_schema",
            strict=True,
        )

    def generate(self, request: WrongAnswerExplanationRequest) -> WrongAnswerExplanationPayload:
        result = self._structured_model.invoke(
            [
                SystemMessage(WRONG_ANSWER_SYSTEM_PROMPT),
                HumanMessage(wrong_answer_explanation_prompt(request)),
            ]
        )
        if isinstance(result, WrongAnswerExplanationPayload):
            return result
        return WrongAnswerExplanationPayload.model_validate(result)


class LangChainOpenAIAdaptivePracticeRecommendationProvider:
    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        chat_model = ChatOpenAI(
            api_key=SecretStr(api_key),
            model=model,
            temperature=0,
            timeout=timeout_seconds,
            max_retries=0,
        )
        self._structured_model = chat_model.with_structured_output(
            AdaptivePracticeRecommendationPayload,
            method="json_schema",
            strict=True,
        )

    def generate(
        self, request: AdaptivePracticeRecommendationRequest
    ) -> AdaptivePracticeRecommendationPayload:
        result = self._structured_model.invoke(
            [
                SystemMessage(ADAPTIVE_PRACTICE_SYSTEM_PROMPT),
                HumanMessage(adaptive_practice_recommendation_prompt(request)),
            ]
        )
        if isinstance(result, AdaptivePracticeRecommendationPayload):
            return result
        return AdaptivePracticeRecommendationPayload.model_validate(result)


class LangChainOpenAIParentReportSummaryProvider:
    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        chat_model = ChatOpenAI(
            api_key=SecretStr(api_key),
            model=model,
            temperature=0,
            timeout=timeout_seconds,
            max_retries=0,
        )
        self._structured_model = chat_model.with_structured_output(
            ParentReportSummaryPayload,
            method="json_schema",
            strict=True,
        )

    def generate(self, request: ParentReportSummaryRequest) -> ParentReportSummaryPayload:
        result = self._structured_model.invoke(
            [
                SystemMessage(PARENT_REPORT_SYSTEM_PROMPT),
                HumanMessage(parent_report_summary_prompt(request)),
            ]
        )
        if isinstance(result, ParentReportSummaryPayload):
            return result
        return ParentReportSummaryPayload.model_validate(result)
