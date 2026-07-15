import pytest
from pydantic import ValidationError

from tankquest_ai.models import QuestionDraftPayload


def test_correct_answer_must_match_one_unique_choice() -> None:
    with pytest.raises(ValidationError):
        QuestionDraftPayload(
            question="What is 1 + 1?",
            choices=["1", "2", "3"],
            correctAnswer="4",
            explanation="Add the two numbers.",
        )


def test_choices_must_be_unique() -> None:
    with pytest.raises(ValidationError):
        QuestionDraftPayload(
            question="What is 1 + 1?",
            choices=["2", "2", "3"],
            correctAnswer="2",
            explanation="Add the two numbers.",
        )
