# Main Backend API

Main backend owns authoritative game and learning state:

- Auth and child profiles
- Tanks, levels, questions, rewards
- Session creation and settlement
- Parent controls and safety boundaries
- AI gateway validation

Read:

- `../../docs/backend-tech-selection.md`
- `../../docs/backend-architecture.md`
- `../../docs/database-design.md`
- `../../docs/api-contract.md`

## Database commands

Copy `.env.example` to `.env`, then use:

```bash
npm run db:validate
npm run db:generate
npm run db:seed
```

The seed is deterministic development content. Production questions, levels, tanks, and rewards remain database/config driven and are never embedded in UI components.
