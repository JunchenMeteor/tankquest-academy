# TankQuest Academy

TankQuest Academy is a family-friendly tank training game that combines tank driving, tactical challenges, learning tasks, progression, and safe AI-assisted education.

The current v0.4 milestone is an installable 2.5D Web learning-game vertical slice with bounded AI learning assistance:

- Phaser 2.5D themed training grounds with recognizable layered tanks and authoritative Arcade Physics combat.
- Math, English, and direction training objectives.
- Three child-owned tanks with persistent visual skins and upgrades.
- Durable learning records and a separate aggregate-only parent report with safe coaching summaries.
- English-default multilingual UI and persistent training themes.
- Backend-authoritative rewards and progression.
- Config-driven tanks, levels, questions, themes, and assets.
- Optional child-safe AI service for question drafts, wrong-answer explanations, adaptive practice suggestions, and parent summaries.
- Strict backend validation and deterministic fallback: AI never decides correctness, rewards, upgrades, final difficulty, or published content.
- Backend-managed, hash-verified visual manifests with safe built-in fallbacks.
- Unified desktop and touch commands plus a safe PWA shell that never caches business API data.

## Repository Layout

```text
apps/
  web/      Web game client
  api/      Main backend API
  desktop/  Tauri Windows technical-preview shell
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

## Windows Technical Preview

Phase 5 packages the accepted Web client in a Tauri 2 Windows shell. Web remains the primary implementation, and the desktop shell does not own answers, rewards, progression, or child data.

Install the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows), including Microsoft C++ Build Tools and WebView2. The repository pins Rust 1.97.0 and the Tauri dependencies used by the technical preview.

On Windows, run the API separately, then start or build the shell from the repository root:

```bash
npm run dev:api
npm run desktop:dev
npm run desktop:build
```

Unsigned preview and release-flavor installers use separate API/CSP pairs:

```bash
npm run desktop:build:preview
npm run desktop:build:release
```

The desktop shell uses environment-specific API/CSP pairs, explicit Tauri runtime selection, and a fail-closed startup check.

Pull requests build an unsigned preview NSIS installer on `windows-latest`, smoke-launch the executable, and upload only the installer for 14 days. The Windows job and the existing Linux core job must both pass before the protected `Verify` check succeeds. The technical preview is not code-signed and Windows may therefore show an unverified-publisher warning.

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
