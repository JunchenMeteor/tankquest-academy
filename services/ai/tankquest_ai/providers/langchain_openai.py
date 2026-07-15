from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from ..models import QuestionDraftPayload, QuestionDraftRequest
from ..prompts import SYSTEM_PROMPT, question_draft_prompt


class LangChainOpenAIQuestionDraftProvider:
    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        chat_model = ChatOpenAI(
            api_key=SecretStr(api_key),
            model=model,
            temperature=0,
            timeout=timeout_seconds,
            max_retries=0,
        )
        self._structured_model = chat_model.with_structured_output(
            QuestionDraftPayload,
            method="json_schema",
            strict=True,
        )

    def generate(self, request: QuestionDraftRequest) -> QuestionDraftPayload:
        result = self._structured_model.invoke(
            [SystemMessage(SYSTEM_PROMPT), HumanMessage(question_draft_prompt(request))]
        )
        if isinstance(result, QuestionDraftPayload):
            return result
        return QuestionDraftPayload.model_validate(result)
