import re

from .models import (
    ParentReportSummaryPayload,
    QuestionDraftPayload,
    WrongAnswerExplanationPayload,
)


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
            r"\b(?:stupid|idiot|dumb|worthless)\b",
            r"(?:姓名|家庭住址|电话号码|邮箱地址|学校名称|诊断|药物|自杀|自残|杀死|血腥|笨蛋|愚蠢|白痴|没用)",
        )
    )
    _parent_report_blocked_patterns = tuple(
        re.compile(pattern, re.IGNORECASE)
        for pattern in (
            r"\b(?:lazy|incapable|hopeless|gifted|genius|bad at|low[- ]ability|"
            r"high[- ]ability|brilliant|slow learner|intelligence|iq)\b",
            r"\b(?:adhd|autis(?:m|tic)|dyslexi(?:a|c)|depress(?:ion|ed))\b",
            r"\b(?:falling behind|serious problem|urgent intervention|must act immediately|"
            r"cause for concern|anxious|anxiety|alarming)\b",
            r"\b(?:share|provide|send|enter)\s+(?:your|the child(?:'s)?)\s+"
            r"(?:name|address|phone|email|school)\b",
            r"(?:懒惰|没天赋|没有天赋|能力差|低能力|高能力|天才|聪明孩子|笨孩子|智力|智商|"
            r"多动症|自闭症|抑郁|落后|严重问题|必须立即|令人担忧|刻不容缓|焦虑)",
            r"请(?:提供|告诉).{0,8}(?:姓名|住址|电话|邮箱|学校)",
        )
    )

    def validate(self, draft: QuestionDraftPayload) -> None:
        content = " ".join(
            [draft.question, *draft.choices, draft.correct_answer, draft.explanation]
        )
        self._validate_content(content)

    def validate_explanation(self, payload: WrongAnswerExplanationPayload) -> None:
        self._validate_content(f"{payload.correct_answer} {payload.explanation}")
        sentence_parts = re.split(r"(?:[!?。！？]+|[.]+(?=\s|$))", payload.explanation)
        if len([part for part in sentence_parts if part.strip()]) > 2:
            raise UnsafeDraftError("generated explanation exceeds two sentences")

    def validate_parent_report_summary(self, payload: ParentReportSummaryPayload) -> None:
        content = " ".join(
            [
                payload.practice_content,
                payload.progress,
                payload.attention,
                payload.next_step,
            ]
        )
        self._validate_content(content)
        if any(pattern.search(content) for pattern in self._parent_report_blocked_patterns):
            raise UnsafeDraftError("generated parent report summary failed safety review")
        for section in (
            payload.practice_content,
            payload.progress,
            payload.attention,
            payload.next_step,
        ):
            sentence_parts = re.split(r"(?:[!?。！？]+|[.]+(?=\s|$))", section)
            if len([part for part in sentence_parts if part.strip()]) > 1:
                raise UnsafeDraftError("generated parent report section exceeds one sentence")

    def _validate_content(self, content: str) -> None:
        if any(pattern.search(content) for pattern in self._blocked_patterns):
            raise UnsafeDraftError("generated draft failed child-safety review")
