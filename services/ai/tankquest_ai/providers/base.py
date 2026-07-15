from typing import Protocol

from ..models import QuestionDraftPayload, QuestionDraftRequest


class QuestionDraftProvider(Protocol):
    def generate(self, request: QuestionDraftRequest) -> QuestionDraftPayload: ...
