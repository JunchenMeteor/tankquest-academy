# TankQuest Academy

TankQuest Academy is a family-friendly tank training game that combines tank driving, tactical challenges, learning tasks, progression, and safe AI-assisted education.

The current v0.3 milestone is a Web learning-game vertical slice with bounded AI learning assistance:

- 2D top-down tank gameplay.
- Math, English, and direction training objectives.
- Three child-owned tanks with persistent visual skins and upgrades.
- Durable learning records and a separate aggregate-only parent report with safe coaching summaries.
- English-default multilingual UI and persistent training themes.
- Backend-authoritative rewards and progression.
- Config-driven tanks, levels, questions, themes, and assets.
- Optional child-safe AI service for question drafts, wrong-answer explanations, adaptive practice suggestions, and parent summaries.
- Strict backend validation and deterministic fallback: AI never decides correctness, rewards, upgrades, final difficulty, or published content.

## Repository Layout

```text
apps/
  web/      Web game client
  api/      Main backend API
services/
  ai/       Optional FastAPI learning-assistance service
packages/
  shared/   Shared DTOs and domain types
docs/       Product and engineering specs
```

## First Documents To Read

Start with:

1. `docs/README.md`
2. `docs/tank-learning-game-dev-spec.md`
3. `docs/mvp-scope.md`
4. `docs/implementation-roadmap.md`

## Development Rule

Do not hardcode production questions, level data, tank stats, reward rules, or user progress inside UI components. Frontend renders API/config data. Backend is authoritative for answer validation, rewards, progression, and child safety rules.

## Local Development

Requirements:

- Node.js 24 or newer.
- Python 3.11 or newer.
- PostgreSQL 15 or newer on `127.0.0.1:5432`.

Install dependencies and initialize the development database:

```bash
npm ci
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e './services/ai[dev]'
export DATABASE_URL=postgresql://tankquest:tankquest@127.0.0.1:5432/tankquest
npm run db:migrate
npm run db:seed
```

Run the API and Web client in separate terminals, keeping `DATABASE_URL` set for the API process:

```bash
npm run dev:api
npm run dev
```

The API listens at `http://127.0.0.1:3000`; the Web client listens at `http://127.0.0.1:5173`. Copy `apps/web/.env.example` to `apps/web/.env.local` only when those client defaults need to change.

## Verification

The standard local gate is:

```bash
npm run format:check
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
```

The protected `Verify` CI job additionally starts a clean PostgreSQL service, applies migrations and deterministic seed data, and runs the Playwright critical journey. For a matching local E2E run, install Chromium once with `npx playwright install chromium`, initialize the database as above, then run `npm run test:e2e`.

Protected `main` and `release` branches deploy preview and release Docker environments through `TankQuest Preview and Release`. Version promotion is managed through `TankQuest Release Manager` and publishes a GitHub Release after production verification.
