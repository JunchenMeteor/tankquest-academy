from ..models import (
    QuestionDraftPayload,
    QuestionDraftRequest,
    WrongAnswerExplanationPayload,
    WrongAnswerExplanationRequest,
)


class TemplateQuestionDraftProvider:
    def generate(self, request: QuestionDraftRequest) -> QuestionDraftPayload:
        if request.locale == "zh-CN":
            return self._chinese_draft(request)
        return self._english_draft(request)

    def _english_draft(self, request: QuestionDraftRequest) -> QuestionDraftPayload:
        if request.subject == "english":
            return QuestionDraftPayload(
                question="Which word means the opposite of 'fast'?",
                choices=["slow", "bright", "tall"],
                correctAnswer="slow",
                explanation="'Slow' is the opposite of 'fast'.",
            )
        if request.subject == "direction":
            return QuestionDraftPayload(
                question="If you face north and turn right, which direction do you face?",
                choices=["east", "west", "south"],
                correctAnswer="east",
                explanation="A right turn from north points east.",
            )

        left = request.difficulty + (1 if request.age_group == "9-12" else 0)
        right = request.difficulty + 1
        answer = left + right
        return QuestionDraftPayload(
            question=f"What is {left} + {right}?",
            choices=[str(answer), str(answer + 1), str(answer - 1)],
            correctAnswer=str(answer),
            explanation=f"Add {left} and {right} to get {answer}.",
        )

    def _chinese_draft(self, request: QuestionDraftRequest) -> QuestionDraftPayload:
        if request.subject == "english":
            return QuestionDraftPayload(
                question="哪个英文单词表示“慢”？",
                choices=["slow", "bright", "tall"],
                correctAnswer="slow",
                explanation="slow 表示“慢”。",
            )
        if request.subject == "direction":
            return QuestionDraftPayload(
                question="面向北方时向右转，会面向哪个方向？",
                choices=["东", "西", "南"],
                correctAnswer="东",
                explanation="从北方顺时针转向右侧就是东方。",
            )

        left = request.difficulty + (1 if request.age_group == "9-12" else 0)
        right = request.difficulty + 1
        answer = left + right
        return QuestionDraftPayload(
            question=f"{left} + {right} 等于多少？",
            choices=[str(answer), str(answer + 1), str(answer - 1)],
            correctAnswer=str(answer),
            explanation=f"把 {left} 和 {right} 相加，得到 {answer}。",
        )


class TemplateWrongAnswerExplanationProvider:
    def generate(self, request: WrongAnswerExplanationRequest) -> WrongAnswerExplanationPayload:
        if request.locale == "zh-CN":
            strategy = {
                "math": "把计算拆成一步一步来做",
                "english": "比较两个词的含义",
                "direction": "先想象面向的方向，再跟着转动",
            }[request.subject]
            explanation = (
                f"我们来检查一下：正确答案是“{request.correct_answer}”。"
                f"{strategy}，再试一道同类题。"
            )
        else:
            strategy = {
                "math": "Work through the calculation one step at a time",
                "english": "Compare the meanings of the two words",
                "direction": "Picture the starting direction, then follow the turn",
            }[request.subject]
            explanation = (
                f'Let\'s check it: the correct answer is "{request.correct_answer}". '
                f"{strategy}, then try a similar question."
            )
        return WrongAnswerExplanationPayload(
            correctAnswer=request.correct_answer,
            explanation=explanation,
        )
