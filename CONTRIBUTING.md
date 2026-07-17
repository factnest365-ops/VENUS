# Contributing to VENUS

Thanks for wanting to contribute. Here's how to add skills, agents, and capabilities.

## Adding a New Agent

1. **Define the agent** in `agents/registry.json`:

```json
{
  "name": "designer",
  "type": "worker",
  "success_rate": 0.8,
  "tasks_completed": 0,
  "description": "Creates UI/UX designs"
}
```

2. **Add spawn logic** if the agent needs special handling in `agents/spawn.ts`.

3. **Write tests** in `tests/` — see existing test files for patterns.

4. **Run the suite**: `npm test`

## Adding a New Skill

Skills live inside the relevant module directory. For example:

- **Core skills** (rules, patterns): edit files in `core/`
- **Memory skills** (new query types): add to `memory/`
- **Personality skills** (new response types): add to `personality/`

Each module has an `index.ts` that re-exports its public API. Add your function there.

## Adding a Rule

Rules drive the evolution engine. Edit `core/rules.md` — one rule per line. The evolve loop reads these and makes decisions.

## Development Workflow

```bash
# Install
npm install

# Run in dev mode (watch)
npm run dev

# Run tests
npm test

# Build
npm run build
```

## Code Style

- TypeScript strict mode
- No external dependencies beyond `zod` and `sql.js`
- Keep modules decoupled — import only what you need
- Tests for every new function

## Pull Requests

1. Fork → branch → commit → PR
2. PR description: what changed, why, how to test
3. All tests pass
4. One maintainer review minimum

## Questions?

Open an issue. Keep it short, describe the problem, include steps to reproduce.
