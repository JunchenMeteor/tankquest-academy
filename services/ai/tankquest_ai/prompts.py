from .models import QuestionDraftRequest

SYSTEM_PROMPT = """You draft one short educational multiple-choice question for a child.
Return only the requested structured fields. Keep the tone calm, encouraging, and age-appropriate.
Never request personal information, include links, discuss diagnosis, or describe real-world harm.
The caller will review the draft; you do not publish it or decide game rewards or progression."""


def question_draft_prompt(request: QuestionDraftRequest) -> str:
    return (
        f"Locale: {request.locale}\n"
        f"Age group: {request.age_group}\n"
        f"Subject: {request.subject}\n"
        f"Skill: {request.skill_key}\n"
        f"Difficulty from 1 to 5: {request.difficulty}\n"
        "Create exactly 3 unique choices and make correctAnswer exactly match one choice."
    )
