# AI Service

Optional FastAPI service for child-safe learning assistance. The service can draft content or
explanations, but the NestJS API remains authoritative for correctness, rewards, upgrades,
progression, persistence, and publication.

The default `template` provider is deterministic and needs no model credentials. An external
OpenAI model can be selected through the provider-neutral LangChain adapter; every generated
result is still checked by `SafetyGuard` and falls back to a safe template on failure.

## Local setup

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e './services/ai[dev]'
uvicorn tankquest_ai.main:app --app-dir services/ai --reload --port 8100
```

The service exposes:

- `GET /health`
- `POST /v1/internal/question-drafts`
- `POST /v1/internal/wrong-answer-explanations`
- `POST /v1/internal/practice-recommendations`
- `POST /v1/internal/parent-report-summaries`

All write endpoints are internal-only. Drafts are never published automatically. Wrong-answer
requests contain no business identifiers or personal data; the service must echo the
backend-supplied correct answer, and NestJS rejects a mismatch before using the explanation.
Adaptive practice requests contain only bounded aggregate learning metrics. The service suggests a
difficulty within `allowedDifficulty`; the NestJS backend remains responsible for the final choice,
level, progression, and persistence.

Parent-report summary requests contain only locale plus bounded aggregate subject and skill
metrics. They never contain child identifiers, profile fields, raw answers, questions, sessions,
or gameplay events. Responses contain four short parent-facing sections and pass strict schema and
`SafetyGuard` checks. Diagnostic claims, ability or personality labels, alarming language, links,
and privacy requests trigger a deterministic template fallback. The NestJS backend remains
authoritative for the report metrics and trend signals.

## Optional external provider

```bash
export AI_PROVIDER=openai
export AI_MODEL='<configured-model-id>'
export OPENAI_API_KEY='<secret>'
```

If any external provider setting is absent, the service reports a degraded provider state and
continues with the template fallback. Health responses and logs never expose secrets.

## Quality checks

With the virtual environment active, the root commands include the AI service:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

Read:

- `../../docs/phase-three-scope.md`
- `../../docs/ai-service-and-safety.md`
- `../../docs/ai-prompt-guidelines.md`
