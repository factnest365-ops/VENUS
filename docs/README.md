# VENUS — Self-Improving AI Agent System

> Mid model + perfect structure = AGI-level performance.

VENUS is a self-evolving agent framework that manages task execution, agent lifecycle, memory persistence, and personality — all with built-in self-improvement via pattern learning.

## Architecture Overview

```
VENUS
├── core/        — Evolution engine, rules, patterns
├── memory/      — SQLite-backed event/pattern storage
├── agents/      — Agent registry, spawning, evaluation
├── money/       — Task pricing & execution engine
└── personality/ — Voice system, humor, greetings
```

## Quick Start

```bash
# Install
npm install

# Run the evolution loop
npx tsx index.ts

# CLI commands
npx tsx index.ts greet    # Get a greeting
npx tsx index.ts status   # Show system stats
npx tsx index.ts joke     # Hear a joke
```

## Core Concepts

### 1. Evolution Loop

The heart of VENUS. It reads rules, patterns, and logs to decide what action to take next:

```typescript
import { evolve } from './core/evolve';

const action = evolve();
// → { type: 'create', target: 'new-pattern.md', reason: 'Template found' }
// → { type: 'edit',   target: 'rules.md',       reason: 'Failures in log' }
// → { type: 'delete', target: 'stale-files',     reason: 'Rules say prune' }
// → { type: 'stop',   reason: 'Done.' }
```

### 2. Memory System

SQLite-backed persistence for events, patterns, and rules:

```typescript
import { initDB, logEvent, searchEvents, getPatterns, addPattern } from './memory';

await initDB();

// Log an event
logEvent('task', 'Built auth module', 'success');

// Search history
const results = searchEvents('auth');

// Get high-success patterns
const patterns = getPatterns(0.8); // min 80% success rate

// Add/update a pattern
addPattern('auth-module-pattern', 0.95);
```

### 3. Agent System

Registry-based agent management with keyword matching and EMA-based scoring:

```typescript
import { runAgent, suggestAgent, getLeaderboard } from './agents';

// Get best agent for a task (without spawning)
const agent = suggestAgent('fix the login bug');
// → 'coder'

// Run an agent (full lifecycle: pick → spawn → execute → record)
const result = await runAgent(
  'implement user auth',
  async (agent, task) => {
    // Your execution logic here
    return true; // succeeded
  }
);
// → { agent: 'coder', succeeded: true, duration_ms: 1420 }

// View performance rankings
const board = getLeaderboard();
// → [{ name: 'reviewer', success_rate: 0.92, tasks_completed: 12 }, ...]
```

### 4. Task Pricing (Money Module)

Credit-based pricing with complexity estimation:

```typescript
import { calculatePrice, executeTask, TASK_TYPES } from './money';

// See all task types
console.log(TASK_TYPES); // ['code-gen', 'review', 'bugfix', 'docs']

// Calculate price for a task
const price = calculatePrice('bugfix', 'Fix null pointer in auth middleware');
// → {
//   type: 'bugfix',
//   label: 'Bug Fix',
//   baseCredits: 100,
//   complexity: 4,
//   multiplier: 1.5,
//   totalCredits: 150
// }

// Execute a task with pricing lifecycle
const result = await executeTask('review', 'Review PR #42', async (task) => {
  return 'LGTM — no issues found';
});
// → { task: {...}, success: true, duration: 89.3 }
```

### 5. Personality System

Situation-aware voice that adapts tone, style, humor, and emoji:

```typescript
import { getVoice, greet, getJoke, respond } from './personality';

// Get voice context
const voice = getVoice({ event: 'error', severity: 'critical' });
// → { tone: 'serious', style: 'cold', humor: 'none', emoji: 'none' }

const voice2 = getVoice({ event: 'idle' });
// → { tone: 'playful', style: 'warm', humor: 'full', emoji: 'moderate' }

// Time-aware greeting
console.log(greet()); // "Morning. Coffee first?" (if before noon)

// Humor check
import { shouldJoke } from './personality/voice';
shouldJoke({ event: 'idle' });    // true
shouldJoke({ event: 'error' });   // false
```

## Configuration

### Agent Registry (`agents/registry.json`)

```json
{
  "agents": [
    { "name": "coder", "type": "worker", "success_rate": 0.85 },
    { "name": "reviewer", "type": "worker", "success_rate": 0.92 }
  ],
  "spawn_rules": {
    "min_success_rate": 0.7,
    "max_concurrent": 5
  }
}
```

### Task Types (`money/tasks.json`)

| Type | Label | Base Credits |
|------|-------|-------------|
| `code-gen` | Code Generation | 0 |
| `review` | Code Review | 5 |
| `bugfix` | Bug Fix | 100 |
| `docs` | Documentation | 0 |

### Evolution Rules (`core/rules.md`)

The `rules.md` file is the governing logic. VENUS reads it on every evolution iteration. Edit it to change behavior.

### Patterns (`core/patterns.md`)

Learned patterns from repeated successes. The evolution engine references these when deciding actions.

## Database

VENUS uses SQLite via `sql.js` (WASM). The database file is stored at `memory/venus.db`.

Tables:
- **events** — timestamped action log
- **patterns** — recurring situations with success rates
- **rules** — governing logic with timestamps

## Project Structure

```
VENUS/
├── index.ts              — CLI entry & exports
├── core/
│   ├── index.ts          — Main evolution loop
│   ├── evolve.ts         — Decision engine
│   ├── rules.md          — Governing rules
│   ├── patterns.md       — Learned patterns
│   └── log.md            — Session log
├── memory/
│   ├── index.ts          — Memory exports & migrations
│   └── recall.ts         — SQLite operations
├── agents/
│   ├── index.ts          — Agent lifecycle (runAgent, suggestAgent)
│   ├── spawn.ts          — Spawn logic & registry
│   ├── evaluate.ts       — Scoring & leaderboard
│   └── registry.json     — Agent definitions
├── money/
│   ├── index.ts          — Module exports
│   ├── pricing.ts        — Complexity & price calculation
│   ├── execute.ts        — Task execution engine
│   └── tasks.json        — Task type definitions
├── personality/
│   ├── index.ts          — Greetings, jokes, responses
│   └── voice.ts          — Voice context system
└── tests/
    ├── evolution.test.ts
    ├── memory.test.ts
    ├── money.test.ts
    └── personality.test.ts
```

## Testing

```bash
npm test           # Run all tests
npm run dev        # Watch mode
```
