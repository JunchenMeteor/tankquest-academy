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

The draft endpoint is internal-only. Drafts are never published automatically.

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
