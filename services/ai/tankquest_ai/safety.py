import re

from .models import QuestionDraftPayload


class UnsafeDraftError(ValueError):
    """Raised when generated learning content violates a child-safety boundary."""


class SafetyGuard:
    _blocked_patterns = tuple(
        re.compile(pattern, re.IGNORECASE)
        for pattern in (
            r"https?://|www\.",
            r"\b(?:full name|home address|phone number|email address|school name)\b",
            r"\b(?:diagnos(?:e|is)|therapy|medication|suicide|self[- ]harm)\b",
            r"\b(?:kill|murder|blood|gore|weapon instructions)\b",
            r"(?:姓名|家庭住址|电话号码|邮箱地址|学校名称|诊断|药物|自杀|自残|杀死|血腥)",
        )
    )

    def validate(self, draft: QuestionDraftPayload) -> None:
        content = " ".join(
            [draft.question, *draft.choices, draft.correct_answer, draft.explanation]
        )
        if any(pattern.search(content) for pattern in self._blocked_patterns):
            raise UnsafeDraftError("generated draft failed child-safety review")
