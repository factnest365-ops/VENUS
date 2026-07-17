# VENUS Architecture

## System Design

VENUS follows a **layered self-improvement architecture** — a closed loop where every execution feeds back into the system's knowledge base, making future executions better.

```
┌─────────────────────────────────────────────────┐
│                    CLI / Entry                   │
│                index.ts (bin: venus)             │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │      Core Engine        │
          │   evolve.ts + main()    │
          │                         │
          │  Rules → Patterns → Log │
          └──┬──────┬──────┬───────┘
             │      │      │
     ┌───────▼─┐ ┌──▼──┐ ┌─▼────────┐
     │ Memory  │ │Agents│ │  Money   │
     │ recall  │ │spawn │ │ pricing  │
     │ SQLite  │ │eval  │ │ execute  │
     └─────────┘ └──────┘ └──────────┘
                       │
              ┌────────▼────────┐
              │   Personality   │
              │   voice.ts      │
              └─────────────────┘
```

## Data Flow

### Evolution Loop (per iteration)

```
1. evolve() reads: rules.md, patterns.md, log.md
         ↓
2. Returns Action { type, target, reason }
         ↓
3. Execute action (create / edit / delete / stop)
         ↓
4. logEvent() persists result to SQLite
         ↓
5. getVoice() adapts output tone
         ↓
6. Repeat until stop
```

### Agent Lifecycle

```
Task arrives
    ↓
pickBestAgent(task)
  ├── Filter by min_success_rate
  ├── Filter by max_concurrent
  ├── Match task keywords to agent
  └── Sort by success_rate DESC
    ↓
spawnAgent(name, taskId)
  ├── Check concurrency limit
  ├── Check no duplicate spawn
  └── Write to active.json
    ↓
executor(agent, task) → boolean
    ↓
recordResult()
  ├── EMA update: old_rate * 0.8 + signal * 0.2
  └── Increment tasks_completed
    ↓
completeSpawn(taskId)
  └── Remove from active.json
```

### Pricing Pipeline

```
Task description
    ↓
estimateComplexity(description)
  ├── Length heuristics (>50, >150, >300 chars)
  ├── Complex keywords: refactor, migrate, security...
  └── Simple keywords: fix typo, rename, format...
  → Returns 1-10 score
    ↓
complexityMultiplier(complexity)
  → Linear: 1 → 1x, 10 → 2.5x
    ↓
calculatePrice(type, description)
  → baseCredits × multiplier = totalCredits
```

## Memory Model

Three SQLite tables:

### events
```sql
CREATE TABLE events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  type      TEXT NOT NULL,      -- 'evolution', 'task', 'agent', etc.
  content   TEXT NOT NULL,      -- Description of what happened
  outcome   TEXT                -- 'success', 'failure', or null
);
```

### patterns
```sql
CREATE TABLE patterns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern      TEXT NOT NULL UNIQUE,
  frequency    INTEGER DEFAULT 1,
  success_rate REAL DEFAULT 0.0
);
```
Patterns use weighted averaging on insert — existing patterns update their rate, new ones seed at the given rate.

### rules
```sql
CREATE TABLE rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  rule         TEXT NOT NULL,
  created      TEXT DEFAULT (datetime('now')),
  last_updated TEXT DEFAULT (datetime('now'))
);
```

## Agent Scoring

Success rates use **Exponential Moving Average (EMA)**:

```
new_rate = old_rate × 0.8 + (succeeded ? 1 : 0) × 0.2
```

This gives 80% weight to historical performance and 20% to the latest result. Agents drift slowly — a single failure doesn't tank a good agent, but repeated failures compound.

**Spawn Rules:**
- `min_success_rate: 0.7` — agents below 70% are excluded
- `max_concurrent: 5` — hard cap on parallel agents

## Voice System

The personality module maps **situations** to **voice contexts**:

| Situation | Tone | Style | Humor | Emoji |
|-----------|------|-------|-------|-------|
| `error` | serious | concise | none | none |
| `success` | brief | concise | minimal | rare |
| `idle` | playful | warm | full | moderate |
| `work` | focused | concise | none | none |
| `frustration` | empathetic | warm | none | none |
| `celebration` | playful | dry | light | rare |
| `routine` | focused | concise | minimal | none |

**Overrides:**
- `error` + `critical` → style becomes `cold`
- `error` + `low` → style becomes `warm` (empathetic toward user)

## Self-Improvement Loop

VENUS's core innovation is the **check → act → log** cycle:

1. **Check** — read patterns for similar past situations
2. **Act** — execute the chosen action
3. **Log** — record outcome to SQLite

When patterns repeat 3+ times, they get extracted into `patterns.md`. When rules fail, they get fixed immediately. The system literally writes its own operating manual over time.

## File-Based vs DB-Based State

| State | Storage | Reason |
|-------|---------|--------|
| Evolution rules | `rules.md` (file) | Human-readable, editable |
| Patterns | `patterns.md` + SQLite | Dual: file for quick read, DB for query |
| Agent registry | `registry.json` | Structured, fast load |
| Active agents | `active.json` | Ephemeral, per-session |
| Event history | SQLite | Queryable, persistent |
| Session log | `log.md` (file) | Human-readable audit trail |

## Design Decisions

1. **SQLite via sql.js (WASM)** — no native dependencies, works everywhere including browsers.
2. **EMA for scoring** — avoids cold-start problems while staying responsive to recent performance.
3. **File + DB dual storage** — rules/patterns stay human-readable files while being queryable.
4. **Dependency injection for execution** — `runAgent` and `executeTask` take handler functions, keeping VENUS framework-agnostic.
5. **Hard concurrency limits** — prevents resource exhaustion without complex scheduling.
