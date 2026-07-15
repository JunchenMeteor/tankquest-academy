from unittest.mock import MagicMock, patch

from tankquest_ai.models import (
    QuestionDraftPayload,
    QuestionDraftRequest,
    WrongAnswerExplanationPayload,
    WrongAnswerExplanationRequest,
)
from tankquest_ai.providers.langchain_openai import (
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
