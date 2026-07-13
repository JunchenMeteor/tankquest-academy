# TankQuest Academy

TankQuest Academy is a family-friendly tank training game that combines tank driving, tactical challenges, learning tasks, progression, and safe AI-assisted education.

The first milestone is a Web MVP:

- 2D top-down tank gameplay.
- Math-driven training objectives.
- Backend-authoritative rewards and progression.
- Config-driven tanks, levels, questions, themes, and assets.
- AI service reserved for question drafts, explanations, and reports.

## Repository Layout

```text
apps/
  web/      Web game client
  api/      Main backend API
services/
  ai/       AI service placeholder
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
