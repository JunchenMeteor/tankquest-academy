# TankQuest Academy Development Rules

These rules adapt the reusable collaboration practices from MeteorVoice to this repository. Product and architecture decisions remain governed by the TankQuest documents in this directory.

## Scope and Safety

- Preserve unrelated work already present in the workspace.
- Keep each change limited to one reviewable topic and prefer existing patterns over speculative abstractions.
- Never commit credentials, tokens, child personal data, or real production secrets.
- Do not hardcode production questions, levels, tanks, rewards, progress, or child data in UI components.
- The backend is authoritative for answers, rewards, upgrades, progression, and child-safety boundaries.

## Branch and Main Workflow

- Start from a clean, up-to-date `main`.
- Branch names use `dev/<type>/<description>`, such as `dev/feature/game-session-api`.
- Never push directly to `main`.
- Every change requires an issue and a pull request.
- Wait for the `Verify` CI check to pass before merging.
- Use squash merge, then update local `main` before creating the next branch.
- Never force-push, delete protected branches, or discard another contributor's work.

## Issue and Pull Request Format

Titles are English and start with one of:

- `[Feature]` for product or architecture capabilities (`enhancement`).
- `[Fix]` for defects (`bug`).
- `[Docs]` for documentation (`documentation`).
- `[Refactor]` for behavior-preserving restructuring (`refactor`).
- `[Chore]` for tooling, CI, dependencies, or maintenance (`chore`).

Issues contain, in order:

```text
## Summary
## Expected Behavior
## Proposed Changes
## Test Plan
```

Pull requests contain, in order:

```text
## Summary
## Test Plan
Closes #<issue>
```

Commit messages do not use bracket prefixes and must not mention AI tools or add automated co-author attribution.

## Architecture Boundaries

- `apps/web` contains the React UI, Phaser runtime, and client adapters.
- `apps/api` contains the authoritative NestJS API and persistence boundary.
- `packages/shared` contains cross-workspace DTOs, schemas, and domain types without platform dependencies.
- `services/ai` remains optional for the MVP and cannot decide correctness, rewards, upgrades, or progression.
- UI and Phaser communicate through explicit commands/events rather than direct cross-layer calls.
- Platform APIs such as `fetch`, storage, and telemetry are wrapped by client-layer adapters.

## Quality Gate

Before pushing a pull request, run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Core rules additionally require focused tests for API contracts, answer validation, settlement idempotency, rewards, upgrades, parent controls, and child/adult mode isolation.

Every pull request reports its data sources, validation performed, residual risks, and explicitly deferred work.
