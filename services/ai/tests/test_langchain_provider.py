from unittest.mock import MagicMock, patch

from tankquest_ai.models import (
    AdaptivePracticeRecommendationPayload,
    AdaptivePracticeRecommendationRequest,
    ParentReportSummaryPayload,
    ParentReportSummaryRequest,
    QuestionDraftPayload,
    QuestionDraftRequest,
    WrongAnswerExplanationPayload,
    WrongAnswerExplanationRequest,
)
from tankquest_ai.providers.langchain_openai import (
    LangChainOpenAIAdaptivePracticeRecommendationProvider,
    LangChainOpenAIParentReportSummaryProvider,
    LangChainOpenAIQuestionDraftProvider,
    LangChainOpenAIWrongAnswerExplanationProvider,
)


def test_langchain_adapter_requests_strict_structured_output() -> None:
    expected = QuestionDraftPayload(
        question="What is 2 + 2?",
        choices=["3", "4", "5"],
        correctAnswer="4",
        explanation="Two plus two is four.",
    )
    structured_model = MagicMock()
    structured_model.invoke.return_value = expected

    with patch("tankquest_ai.providers.langchain_openai.ChatOpenAI") as chat_model_class:
        chat_model_class.return_value.with_structured_output.return_value = structured_model
        provider = LangChainOpenAIQuestionDraftProvider(
            api_key="test-only-key",
            model="configured-model",
            timeout_seconds=8,
        )
        result = provider.generate(
            QuestionDraftRequest(
                ageGroup="6-8",
                locale="en",
                subject="math",
                skillKey="addition-within-20",
                difficulty=1,
            )
        )

    assert result == expected
    chat_model_class.return_value.with_structured_output.assert_called_once_with(
        QuestionDraftPayload,
        method="json_schema",
        strict=True,
    )
    messages = structured_model.invoke.call_args.args[0]
    assert len(messages) == 2
    assert "personal information" in messages[0].content
    assert "addition-within-20" in messages[1].content


def test_langchain_explanation_echoes_the_authoritative_answer() -> None:
    expected = WrongAnswerExplanationPayload(
        correctAnswer="15",
        explanation="Add 8 and 7 one step at a time to get 15.",
    )
    structured_model = MagicMock()
    structured_model.invoke.return_value = expected

    with patch("tankquest_ai.providers.langchain_openai.ChatOpenAI") as chat_model_class:
        chat_model_class.return_value.with_structured_output.return_value = structured_model
        provider = LangChainOpenAIWrongAnswerExplanationProvider(
            api_key="test-only-key",
            model="configured-model",
            timeout_seconds=8,
        )
        result = provider.generate(
            WrongAnswerExplanationRequest(
                ageGroup="6-8",
                locale="en",
                subject="math",
                skillKey="addition-within-20",
                difficulty=1,
                question="8 + 7 = ?",
                selectedAnswer="12",
                correctAnswer="15",
            )
        )

    assert result == expected
    chat_model_class.return_value.with_structured_output.assert_called_once_with(
        WrongAnswerExplanationPayload,
        method="json_schema",
        strict=True,
    )
    messages = structured_model.invoke.call_args.args[0]
    assert "never change" in messages[0].content
    assert "Authoritative correct answer: 15" in messages[1].content


def test_langchain_adaptive_practice_provider_uses_bounded_structured_output() -> None:
    expected = AdaptivePracticeRecommendationPayload(
        subject="math",
        skillKey="addition-within-20",
        recommendedDifficulty=3,
        practiceIntent="reinforce",
    )
    structured_model = MagicMock()
    structured_model.invoke.return_value = expected

    with patch("tankquest_ai.providers.langchain_openai.ChatOpenAI") as chat_model_class:
        chat_model_class.return_value.with_structured_output.return_value = structured_model
        provider = LangChainOpenAIAdaptivePracticeRecommendationProvider(
            api_key="test-only-key",
            model="configured-model",
            timeout_seconds=8,
        )
        result = provider.generate(
            AdaptivePracticeRecommendationRequest(
                ageGroup="6-8",
                subject="math",
                skillKey="addition-within-20",
                currentDifficulty=3,
                attempts=8,
                accuracy=75,
                averageAnswerTimeMs=15_000,
                completedSessions=2,
                allowedDifficulty={"min": 2, "max": 4},
            )
        )

    assert result == expected
    chat_model_class.return_value.with_structured_output.assert_called_once_with(
        AdaptivePracticeRecommendationPayload,
        method="json_schema",
        strict=True,
    )
    messages = structured_model.invoke.call_args.args[0]
    assert "authoritative backend decides" in messages[0].content
    assert "Allowed difficulty inclusive: 2 to 4" in messages[1].content
    assert "Do not decide a level" in messages[1].content


def test_langchain_parent_report_provider_uses_aggregate_structured_output() -> None:
    expected = ParentReportSummaryPayload(
        practiceContent="Practiced math across three sessions.",
        progress="Addition has an improving signal.",
        attention="Subtraction needs more practice.",
        nextStep="Use a short subtraction practice next.",
    )
    structured_model = MagicMock()
    structured_model.invoke.return_value = expected

    with patch("tankquest_ai.providers.langchain_openai.ChatOpenAI") as chat_model_class:
        chat_model_class.return_value.with_structured_output.return_value = structured_model
        provider = LangChainOpenAIParentReportSummaryProvider(
            api_key="test-only-key",
            model="configured-model",
            timeout_seconds=8,
        )
        result = provider.generate(
            ParentReportSummaryRequest(
                locale="en",
                completedSessions=3,
                totalAnswers=10,
                subjects=[
                    {
                        "subject": "math",
                        "attempts": 10,
                        "accuracy": 80,
                        "averageAnswerTimeMs": 8_000,
                    }
                ],
                skills=[
                    {
                        "subject": "math",
                        "skillKey": "addition-within-20",
                        "attempts": 6,
                        "accuracy": 90,
                        "averageAnswerTimeMs": 7_000,
                        "currentDifficulty": 2,
                        "trend": "improving",
                    }
                ],
            )
        )

    assert result == expected
    chat_model_class.return_value.with_structured_output.assert_called_once_with(
        ParentReportSummaryPayload,
        method="json_schema",
        strict=True,
    )
    messages = structured_model.invoke.call_args.args[0]
    assert "Never diagnose" in messages[0].content
    assert "Aggregate subject metrics" in messages[1].content
    assert "addition-within-20" in messages[1].content
    assert "childId" not in messages[1].content
