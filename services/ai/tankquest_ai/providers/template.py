from ..models import (
    AdaptivePracticeRecommendationPayload,
    AdaptivePracticeRecommendationRequest,
    ParentReportSkillMetric,
    ParentReportSummaryPayload,
    ParentReportSummaryRequest,
    PracticeIntent,
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


class TemplateAdaptivePracticeRecommendationProvider:
    def generate(
        self, request: AdaptivePracticeRecommendationRequest
    ) -> AdaptivePracticeRecommendationPayload:
        allowed = request.allowed_difficulty
        current = min(max(request.current_difficulty, allowed.minimum), allowed.maximum)

        if request.attempts < 3 or request.completed_sessions < 1:
            recommended = current
            intent: PracticeIntent = "reinforce"
        elif request.accuracy < 60 or request.average_answer_time_ms > 30_000:
            recommended = current - 1
            intent = "review"
        elif (
            request.accuracy >= 85
            and request.attempts >= 5
            and request.average_answer_time_ms <= 20_000
        ):
            recommended = current + 1
            intent = "challenge"
        else:
            recommended = current
            intent = "reinforce"

        return AdaptivePracticeRecommendationPayload(
            subject=request.subject,
            skillKey=request.skill_key,
            recommendedDifficulty=min(max(recommended, allowed.minimum), allowed.maximum),
            practiceIntent=intent,
        )


class TemplateParentReportSummaryProvider:
    def generate(self, request: ParentReportSummaryRequest) -> ParentReportSummaryPayload:
        if request.locale == "zh-CN":
            return self._chinese_summary(request)
        return self._english_summary(request)

    def _english_summary(self, request: ParentReportSummaryRequest) -> ParentReportSummaryPayload:
        subjects = ", ".join(
            self._subject_name(metric.subject, "en") for metric in request.subjects
        )
        improving = self._select_skill(request, "improving")
        attention = self._select_skill(request, "needs-practice")
        focus = attention or self._lowest_accuracy_skill(request)

        practice_content = (
            f"Completed {request.completed_sessions} sessions and {request.total_answers} answers"
            + (f" across {subjects}." if subjects else ".")
        )
        progress = (
            f"A clear improvement signal appears in {self._skill_name(improving)}."
            if improving
            else "There is not enough evidence yet to identify a clear improvement trend."
        )
        attention_text = (
            f"More practice may help with {self._skill_name(attention)}."
            if attention
            else "No skill currently has a strong needs-practice signal."
        )
        next_step = (
            f"Use a short, focused practice on {self._skill_name(focus)} next."
            if focus
            else "Complete a few more practice questions before choosing a focus skill."
        )
        return ParentReportSummaryPayload(
            practiceContent=practice_content,
            progress=progress,
            attention=attention_text,
            nextStep=next_step,
        )

    def _chinese_summary(self, request: ParentReportSummaryRequest) -> ParentReportSummaryPayload:
        subjects = "、".join(
            self._subject_name(metric.subject, "zh-CN") for metric in request.subjects
        )
        improving = self._select_skill(request, "improving")
        attention = self._select_skill(request, "needs-practice")
        focus = attention or self._lowest_accuracy_skill(request)

        practice_content = (
            f"共完成 {request.completed_sessions} 局、{request.total_answers} 道题"
            + (f"，练习内容包括{subjects}。" if subjects else "。")
        )
        progress = (
            f"{self._skill_name(improving)}呈现出明确的进步信号。"
            if improving
            else "目前还没有足够证据判断明确的进步趋势。"
        )
        attention_text = (
            f"可以继续练习{self._skill_name(attention)}。"
            if attention
            else "目前没有技能呈现明显的需要加强信号。"
        )
        next_step = (
            f"下一步可以安排一次简短的{self._skill_name(focus)}专项练习。"
            if focus
            else "再完成几道练习题后，再确定下一项重点。"
        )
        return ParentReportSummaryPayload(
            practiceContent=practice_content,
            progress=progress,
            attention=attention_text,
            nextStep=next_step,
        )

    @staticmethod
    def _select_skill(
        request: ParentReportSummaryRequest, trend: str
    ) -> ParentReportSkillMetric | None:
        candidates = [skill for skill in request.skills if skill.trend == trend]
        return (
            min(candidates, key=lambda skill: (skill.accuracy, skill.subject, skill.skill_key))
            if candidates
            else None
        )

    @staticmethod
    def _lowest_accuracy_skill(
        request: ParentReportSummaryRequest,
    ) -> ParentReportSkillMetric | None:
        return min(
            request.skills,
            key=lambda skill: (skill.accuracy, skill.subject, skill.skill_key),
            default=None,
        )

    @staticmethod
    def _skill_name(skill: ParentReportSkillMetric) -> str:
        return skill.skill_key.replace("-", " ")

    @staticmethod
    def _subject_name(subject: str, locale: str) -> str:
        names = {
            "en": {
                "math": "math",
                "english": "English",
                "direction": "directions",
                "logic": "logic",
                "physics": "physics",
            },
            "zh-CN": {
                "math": "数学",
                "english": "英语",
                "direction": "方向",
                "logic": "逻辑",
                "physics": "物理",
            },
        }
        return names[locale][subject]
