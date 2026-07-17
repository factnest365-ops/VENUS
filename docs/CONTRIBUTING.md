# Contributing to VENUS

## How to Extend

VENUS is designed to be extended at every layer. Here's how.

---

## Adding a New Agent

1. Edit `agents/registry.json`:

```json
{
  "name": "my-agent",
  "type": "worker",
  "success_rate": 0.85,
  "tasks_completed": 0,
  "description": "What this agent does"
}
```

2. Add keyword mapping in `agents/spawn.ts` → `taskMatchesAgent()`:

```typescript
const keywords: Record<string, string[]> = {
  // ...existing agents...
  'my-agent': ['keyword1', 'keyword2', 'keyword3'],
};
```

3. That's it. The agent is now eligible for task matching, spawning, and leaderboard tracking.

**Rules:**
- Agent names are lowercase, hyphenated
- `success_rate` starts at 0.0-1.0 (typically 0.8-0.9 for new agents)
- `max_concurrent` in spawn_rules caps total parallel agents

---

## Adding a New Task Type

1. Edit `money/tasks.json`:

```json
{
  "taskTypes": {
    "my-task": {
      "label": "My Task Type",
      "baseCredits": 50,
      "description": "What this task type covers"
    }
  }
}
```

2. Import `TASK_TYPES` from `money/index.ts` — your new type is automatically included.

**Pricing tuning:**
- `baseCredits: 0` — free/complimentary tasks
- `baseCredits: 5-20` — lightweight tasks
- `baseCredits: 50-100` — moderate tasks
- `baseCredits: 200+` — complex/expensive tasks

---

## Adding Voice Situations

1. Add a new event type to `Situation` in `personality/voice.ts`:

```typescript
interface Situation {
  event: 'error' | 'success' | ... | 'my-event';
  // ...
}
```

2. Add a voice mapping in the `voices` record:

```typescript
const voices: Record<Situation["event"], VoiceContext> = {
  // ...existing...
  'my-event': {
    tone: 'focused',
    style: 'concise',
    humor: 'none',
    emoji: 'none',
  },
};
```

3. Add a prefix in `getVoicePrefix()` if needed.

---

## Adding Memory Tables

1. Create a new file in `memory/` for the table logic.
2. Add the `CREATE TABLE` to `initDB()` in `recall.ts`.
3. Export functions from `memory/index.ts`.

**Pattern:**
```typescript
export function myQuery(param: string): Result[] {
  const stmt = db.prepare('SELECT * FROM my_table WHERE col = ?');
  stmt.bind([param]);
  const results: Result[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as any);
  }
  stmt.free();
  return results;
}
```

---

## Adding CLI Commands

Edit the `switch` in `index.ts`:

```typescript
case 'my-command':
  const { myFunction } = await import('./my-module');
  console.log(myFunction());
  break;
```

---

## Writing Tests

Tests live in `tests/` and use Vitest:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../my-module';

describe('myFunction', () => {
  it('does the thing', () => {
    expect(myFunction('input')).toBe('output');
  });
});
```

Run with `npm test` or `npx vitest`.

---

## Adding New Patterns

Patterns are the self-improvement mechanism. When you notice a repeated success:

1. Describe the trigger (what prompted it)
2. Describe the action (what was done)
3. Record the success rate

Add to `core/patterns.md`:

```markdown
## Pattern: auth-module-creation
- **Trigger:** Task contains "auth", "login", or "session"
- **Action:** Spawn coder with auth template, reviewer validates
- **Success Rate:** 92%
```

The evolution engine reads this file and references patterns when deciding actions.

---

## Modifying Evolution Rules

Edit `core/rules.md`. The evolution engine reads it on every iteration.

**Priority order (checked top to bottom):**
1. STOP token → halt
2. Repetition detection → halt
3. Template in patterns → create
4. Prune in rules → delete
5. Failures in log → edit rules
6. Low success patterns → edit patterns
7. Default → edit patterns

**Adding a new rule:** Insert it with a numbered header. The engine processes rules by reading the file content, so keyword presence matters.

---

## Code Style

- TypeScript strict mode
- No external dependencies beyond `sql.js` and `zod`
- Functions should be pure where possible
- Error handling: catch and log, don't throw up
- Keep modules decoupled — inject dependencies, don't import across layers

---

## File Naming

| Convention | Example |
|-----------|---------|
| Modules | `camelCase.ts` |
| Tests | `*.test.ts` |
| Config | `*.json` |
| Docs | `UPPERCASE.md` |
| Data | `lowercase.md` |
