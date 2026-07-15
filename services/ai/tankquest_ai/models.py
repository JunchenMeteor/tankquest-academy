from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

AgeGroup = Literal["6-8", "9-12"]
Locale = Literal["en", "zh-CN"]
Subject = Literal["math", "english", "direction"]
DraftSource = Literal["template", "model"]
FallbackReason = Literal["config_missing", "provider_error", "unsafe_output"]


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


class HealthResponse(StrictModel):
    status: Literal["ok", "degraded"]
    requested_provider: Literal["template", "openai"] = Field(alias="requestedProvider")
    effective_provider: DraftSource = Field(alias="effectiveProvider")
