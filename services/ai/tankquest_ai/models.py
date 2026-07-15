from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

AgeGroup = Literal["6-8", "9-12"]
Locale = Literal["en", "zh-CN"]
Subject = Literal["math", "english", "direction"]
ReportSubject = Literal["math", "english", "direction", "logic", "physics"]
DraftSource = Literal["template", "model"]
FallbackReason = Literal["config_missing", "provider_error", "unsafe_output", "invalid_output"]
PracticeIntent = Literal["review", "reinforce", "challenge"]
LearningTrend = Literal["improving", "steady", "needs-practice", "insufficient-data"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class QuestionDraftRequest(StrictModel):
    age_group: AgeGroup = Field(alias="ageGroup")
    locale: Locale = "en"
    subject: Subject
    skill_key: str = Field(alias="skillKey", min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    difficulty: int = Field(ge=1, le=5)


class QuestionDraftPayload(StrictModel):
    question: str = Field(min_length=1, max_length=240)
    choices: list[str] = Field(min_length=3, max_length=4)
    correct_answer: str = Field(alias="correctAnswer", min_length=1, max_length=80)
    explanation: str = Field(min_length=1, max_length=320)

    @field_validator("question", "correct_answer", "explanation")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("choices")
    @classmethod
    def normalize_choices(cls, choices: list[str]) -> list[str]:
        normalized = [choice.strip() for choice in choices]
        if any(not choice or len(choice) > 80 for choice in normalized):
            raise ValueError("choices must contain 1 to 80 characters")
        if len(set(normalized)) != len(normalized):
            raise ValueError("choices must be unique")
        return normalized

    @model_validator(mode="after")
    def correct_answer_is_a_choice(self) -> "QuestionDraftPayload":
        if self.choices.count(self.correct_answer) != 1:
            raise ValueError("correctAnswer must match exactly one choice")
        return self


class QuestionDraftResponse(StrictModel):
    request_id: str = Field(alias="requestId")
    source: DraftSource
    fallback_reason: FallbackReason | None = Field(default=None, alias="fallbackReason")
    draft: QuestionDraftPayload


class WrongAnswerExplanationRequest(StrictModel):
    age_group: AgeGroup = Field(alias="ageGroup")
    locale: Locale = "en"
    subject: Subject
    skill_key: str = Field(alias="skillKey", min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    difficulty: int = Field(ge=1, le=5)
    question: str = Field(min_length=1, max_length=240)
    selected_answer: str = Field(alias="selectedAnswer", min_length=1, max_length=80)
    correct_answer: str = Field(alias="correctAnswer", min_length=1, max_length=80)

    @field_validator("question", "selected_answer", "correct_answer")
    @classmethod
    def strip_input_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def selected_answer_is_incorrect(self) -> "WrongAnswerExplanationRequest":
        if self.selected_answer == self.correct_answer:
            raise ValueError("selectedAnswer must differ from correctAnswer")
        return self


class WrongAnswerExplanationPayload(StrictModel):
    correct_answer: str = Field(alias="correctAnswer", min_length=1, max_length=80)
    explanation: str = Field(min_length=1, max_length=320)

    @field_validator("correct_answer", "explanation")
    @classmethod
    def strip_output_text(cls, value: str) -> str:
        return value.strip()


class WrongAnswerExplanationResponse(StrictModel):
    request_id: str = Field(alias="requestId")
    source: DraftSource
    fallback_reason: FallbackReason | None = Field(default=None, alias="fallbackReason")
    correct_answer: str = Field(alias="correctAnswer", min_length=1, max_length=80)
    explanation: str = Field(min_length=1, max_length=320)


class AllowedDifficulty(StrictModel):
    minimum: int = Field(alias="min", ge=1, le=5)
    maximum: int = Field(alias="max", ge=1, le=5)

    @model_validator(mode="after")
    def minimum_does_not_exceed_maximum(self) -> "AllowedDifficulty":
        if self.minimum > self.maximum:
            raise ValueError("allowedDifficulty.min must not exceed allowedDifficulty.max")
        return self


class AdaptivePracticeRecommendationRequest(StrictModel):
    age_group: AgeGroup = Field(alias="ageGroup")
    subject: Subject
    skill_key: str = Field(alias="skillKey", min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    current_difficulty: int = Field(alias="currentDifficulty", ge=1, le=5)
    attempts: int = Field(ge=0, le=100_000)
    accuracy: float = Field(ge=0, le=100)
    average_answer_time_ms: int = Field(alias="averageAnswerTimeMs", ge=0, le=1_800_000)
    completed_sessions: int = Field(alias="completedSessions", ge=0, le=100_000)
    allowed_difficulty: AllowedDifficulty = Field(alias="allowedDifficulty")


class AdaptivePracticeRecommendationPayload(StrictModel):
    subject: Subject
    skill_key: str = Field(alias="skillKey", min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    recommended_difficulty: int = Field(alias="recommendedDifficulty", ge=1, le=5)
    practice_intent: PracticeIntent = Field(alias="practiceIntent")


class AdaptivePracticeRecommendationResponse(AdaptivePracticeRecommendationPayload):
    request_id: str = Field(alias="requestId")
    source: DraftSource
    fallback_reason: FallbackReason | None = Field(default=None, alias="fallbackReason")


class ParentReportSubjectMetric(StrictModel):
    subject: ReportSubject
    attempts: int = Field(ge=0, le=100_000)
    accuracy: float = Field(ge=0, le=100)
    average_answer_time_ms: int = Field(alias="averageAnswerTimeMs", ge=0, le=1_800_000)


class ParentReportSkillMetric(ParentReportSubjectMetric):
    skill_key: str = Field(alias="skillKey", min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    current_difficulty: int | None = Field(default=None, alias="currentDifficulty", ge=1, le=5)
    trend: LearningTrend


class ParentReportSummaryRequest(StrictModel):
    locale: Locale = "en"
    completed_sessions: int = Field(alias="completedSessions", ge=0, le=100_000)
    total_answers: int = Field(alias="totalAnswers", ge=0, le=100_000)
    subjects: list[ParentReportSubjectMetric] = Field(max_length=5)
    skills: list[ParentReportSkillMetric] = Field(max_length=5)


class ParentReportSummaryPayload(StrictModel):
    practice_content: str = Field(alias="practiceContent", min_length=1, max_length=240)
    progress: str = Field(min_length=1, max_length=240)
    attention: str = Field(min_length=1, max_length=240)
    next_step: str = Field(alias="nextStep", min_length=1, max_length=240)

    @field_validator("practice_content", "progress", "attention", "next_step")
    @classmethod
    def strip_summary_text(cls, value: str) -> str:
        return value.strip()


class ParentReportSummaryResponse(StrictModel):
    request_id: str = Field(alias="requestId")
    source: DraftSource
    fallback_reason: FallbackReason | None = Field(default=None, alias="fallbackReason")
    summary: ParentReportSummaryPayload


class HealthResponse(StrictModel):
    status: Literal["ok", "degraded"]
    requested_provider: Literal["template", "openai"] = Field(alias="requestedProvider")
    effective_provider: DraftSource = Field(alias="effectiveProvider")
