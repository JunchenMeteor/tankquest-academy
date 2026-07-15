from .models import QuestionDraftRequest, WrongAnswerExplanationRequest

SYSTEM_PROMPT = """You draft one short educational multiple-choice question for a child.
Return only the requested structured fields. Keep the tone calm, encouraging, and age-appropriate.
Never request personal information, include links, discuss diagnosis, or describe real-world harm.
The caller will review the draft; you do not publish it or decide game rewards or progression."""

WRONG_ANSWER_SYSTEM_PROMPT = """You explain one answer that the authoritative backend has
already marked incorrect. Return only the requested structured fields. Echo the supplied
correct answer exactly and never change it.
Use at most two short, calm, non-blaming sentences with one useful reasoning step.
Never request personal information, include links, discuss diagnosis, or describe real-world harm.
You do not decide correctness, rewards, progression, or persistence."""


def question_draft_prompt(request: QuestionDraftRequest) -> str:
    return (
        f"Locale: {request.locale}\n"
        f"Age group: {request.age_group}\n"
        f"Subject: {request.subject}\n"
        f"Skill: {request.skill_key}\n"
        f"Difficulty from 1 to 5: {request.difficulty}\n"
        "Create exactly 3 unique choices and make correctAnswer exactly match one choice."
    )


def wrong_answer_explanation_prompt(request: WrongAnswerExplanationRequest) -> str:
    return (
        f"Locale: {request.locale}\n"
        f"Age group: {request.age_group}\n"
        f"Subject: {request.subject}\n"
        f"Skill: {request.skill_key}\n"
        f"Difficulty from 1 to 5: {request.difficulty}\n"
        f"Question: {request.question}\n"
        f"Incorrect selected answer: {request.selected_answer}\n"
        f"Authoritative correct answer: {request.correct_answer}\n"
        "Explain the mistake with one reasoning step and echo the authoritative "
        "correct answer exactly."
    )
