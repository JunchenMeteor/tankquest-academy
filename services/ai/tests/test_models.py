import pytest
from pydantic import ValidationError

from tankquest_ai.models import (
    AdaptivePracticeRecommendationRequest,
    QuestionDraftPayload,
    WrongAnswerExplanationRequest,
)


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


def test_wrong_answer_request_rejects_a_correct_selection() -> None:
    with pytest.raises(ValidationError):
        WrongAnswerExplanationRequest(
            ageGroup="6-8",
            locale="en",
            subject="math",
            skillKey="addition-within-20",
            difficulty=1,
            question="8 + 7 = ?",
            selectedAnswer="15",
            correctAnswer="15",
        )


def test_adaptive_practice_request_rejects_reversed_allowed_range() -> None:
    with pytest.raises(ValidationError):
        AdaptivePracticeRecommendationRequest(
            ageGroup="6-8",
            subject="math",
            skillKey="addition-within-20",
            currentDifficulty=2,
            attempts=4,
            accuracy=75,
            averageAnswerTimeMs=15_000,
            completedSessions=1,
            allowedDifficulty={"min": 4, "max": 2},
        )
