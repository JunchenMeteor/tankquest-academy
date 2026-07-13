# Agent Development Rules

## Scope

This repository is a Web-first tank learning game. Preserve the product direction described in `docs/`.

## Required Reading

Before implementation, read:

1. `docs/README.md`
2. `docs/mvp-scope.md`
3. The most relevant architecture document for the area being changed.

## Hard Rules

- Do not hardcode production questions, tanks, rewards, levels, or child data in UI components.
- Backend owns answer validation, rewards, tank upgrades, progression, and child safety.
- AI service can suggest or explain, but cannot decide rewards, correctness, or progression.
- Keep children mode and adult mode separated.
- Add or update tests for core rules, API contracts, rewards, progression, and safety boundaries.
- Keep files small. Split UI, game systems, clients, and services when a file grows too large.
- One PR should have one reviewable topic.

## MVP Boundary

For the first implementation phase, do not build multiplayer, full 3D, payment, mobile packaging, or complex AI workflows unless explicitly requested.

## Collaboration Workflow

- Read `docs/development-rules.md` before changing code or repository configuration.
- Work on `dev/<type>/<description>` branches created from the latest `main`.
- Never push directly to `main`; every change requires an issue, a pull request, and a passing `Verify` check.
- After a pull request is merged, update local `main` before creating the next branch.
- Issue and pull request titles are English and use `[Feature]`, `[Fix]`, `[Docs]`, `[Refactor]`, or `[Chore]`.
- Commit messages do not use bracket prefixes and must not include AI or tool attribution.
