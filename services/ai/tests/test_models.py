import pytest
from pydantic import ValidationError

from tankquest_ai.models import (
    AdaptivePracticeRecommendationRequest,
    ParentReportSummaryPayload,
    ParentReportSummaryRequest,
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


def test_parent_report_summary_request_rejects_extra_nested_data() -> None:
    with pytest.raises(ValidationError):
        ParentReportSummaryRequest.model_validate(
            {
                "locale": "en",
                "completedSessions": 2,
                "totalAnswers": 5,
                "subjects": [
                    {
                        "subject": "math",
                        "attempts": 5,
                        "accuracy": 80,
                        "averageAnswerTimeMs": 7_000,
                        "selectedAnswer": "private raw answer",
                    }
                ],
                "skills": [],
            }
        )


def test_parent_report_summary_request_limits_prompt_cardinality() -> None:
    skill = {
        "subject": "math",
        "skillKey": "addition-within-20",
        "attempts": 5,
        "accuracy": 80,
        "averageAnswerTimeMs": 7_000,
        "trend": "steady",
    }

    with pytest.raises(ValidationError):
        ParentReportSummaryRequest.model_validate(
            {
                "locale": "en",
                "completedSessions": 2,
                "totalAnswers": 5,
                "subjects": [],
                "skills": [skill] * 6,
            }
        )


def test_parent_report_summary_payload_strips_and_limits_each_section() -> None:
    payload = ParentReportSummaryPayload(
        practiceContent="  Practiced math.  ",
        progress="Progress was steady.",
        attention="Continue watching addition.",
        nextStep="Use a short practice next.",
    )

    assert payload.practice_content == "Practiced math."
    with pytest.raises(ValidationError):
        ParentReportSummaryPayload(
            practiceContent="x" * 241,
            progress="Progress was steady.",
            attention="Continue watching addition.",
            nextStep="Use a short practice next.",
        )
