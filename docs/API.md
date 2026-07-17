# VENUS API Reference

All exported functions from the VENUS package.

---

## Core

### `evolve()`

**Module:** `core/evolve`

Decides the next action based on rules, patterns, and logs.

```typescript
function evolve(): Action

interface Action {
  type: 'create' | 'edit' | 'delete' | 'stop';
  target?: string;
  reason: string;
}
```

**Returns:** An `Action` describing what to do next.

**Rules engine priority:**
1. Empty log → stop
2. STOP token in last log → stop
3. Repeated action 2× → stop (loop prevention)
4. Template in patterns → create
5. "prune" in rules → delete
6. Failures in log → edit rules
7. Low success patterns → edit patterns
8. Default → edit patterns

---

### `resetEvolution()`

**Module:** `core/evolve`

Resets the repeat-detection state (call between sessions).

```typescript
function resetEvolution(): void
```

---

### `main()`

**Module:** `core`

Runs the full evolution loop (init → evolve → execute → log × N).

```typescript
async function main(): Promise<void>
```

---

## Memory

### `initDB(path?)`

**Module:** `memory/recall`

Initializes the SQLite database. Creates tables if they don't exist.

```typescript
async function initDB(path?: string): Promise<Database>
```

- `path` — custom DB file path (default: `memory/venus.db`)
- Returns the `sql.js` Database instance

---

### `logEvent(type, content, outcome?)`

**Module:** `memory/recall`

Records an event to the database.

```typescript
function logEvent(
  type: string,       // e.g. 'evolution', 'task', 'agent'
  content: string,    // Description of what happened
  outcome?: string    // 'success' | 'failure' | null
): number             // Returns the new row ID
```

---

### `searchEvents(query, limit?)`

**Module:** `memory/recall`

Full-text search across event type, content, and outcome.

```typescript
function searchEvents(
  query: string,
  limit?: number       // Default: 20
): Array<{
  id: number;
  type: string;
  content: string;
  outcome: string | null;
  timestamp: string;
}>
```

---

### `getPatterns(minRate?)`

**Module:** `memory/recall`

Get patterns sorted by success rate, filtered by minimum threshold.

```typescript
function getPatterns(
  minRate?: number     // Default: 0.5 (50%)
): Array<{
  id: number;
  pattern: string;
  success_rate: number;
  frequency: number;
}>
```

---

### `addPattern(pattern, successRate?)`

**Module:** `memory/recall`

Add a new pattern or update an existing one's success rate via weighted average.

```typescript
function addPattern(
  pattern: string,
  successRate?: number  // Default: 0
): number               // Returns pattern ID
```

If the pattern already exists, the new rate is blended: `(oldRate × freq + newRate) / (freq + 1)`.

---

### `updateRule(id, rule)`

**Module:** `memory/recall`

Update a rule's text and timestamp.

```typescript
function updateRule(id: number, rule: string): boolean
```

---

### `getStats()`

**Module:** `memory/recall`

Get row counts for all tables.

```typescript
function getStats(): {
  events: number;
  patterns: number;
  rules: number;
}
```

---

## Agents

### `pickBestAgent(task)`

**Module:** `agents/spawn`

Select the best available agent for a task using keyword matching and success rate ranking.

```typescript
function pickBestAgent(task: string): Agent | null
```

**Keyword mapping:**
| Agent | Keywords |
|-------|----------|
| coder | code, implement, write, build, create, fix, refactor |
| reviewer | review, audit, check, validate, lint |
| researcher | research, investigate, find, search, analyze, compare |
| planner | plan, decompose, architect, design, strategy |
| tester | test, verify, validate, assert, spec |

**Filters:** min_success_rate, max_concurrent, no duplicate spawns.

---

### `spawnAgent(agentName, taskId)`

**Module:** `agents/spawn`

Spawn an agent for a task. Adds to active agents list.

```typescript
function spawnAgent(
  agentName: string,
  taskId: string
): ActiveAgent | null

interface ActiveAgent {
  agent: string;
  task_id: string;
  started_at: number;
}
```

Returns `null` if: agent not found, concurrency limit reached, or agent already active.

---

### `completeSpawn(taskId)`

**Module:** `agents/spawn`

Remove an agent from the active list when done.

```typescript
function completeSpawn(taskId: string): void
```

---

### `getActiveAgents()`

**Module:** `agents/spawn`

List currently running agents.

```typescript
function getActiveAgents(): ActiveAgent[]
```

---

### `recordResult(result)`

**Module:** `agents/evaluate`

Record a task result and update the agent's success rate via EMA.

```typescript
function recordResult(result: TaskResult): Agent | null

interface TaskResult {
  agent: string;
  task_id: string;
  succeeded: boolean;
  duration_ms?: number;
  notes?: string;
}
```

**EMA formula:** `new_rate = old_rate × 0.8 + signal × 0.2`

---

### `recordBatch(results)`

**Module:** `agents/evaluate`

Record multiple results in a single registry write.

```typescript
function recordBatch(results: TaskResult[]): (Agent | null)[]
```

---

### `getLeaderboard()`

**Module:** `agents/evaluate`

Get all agents sorted by success rate (descending).

```typescript
function getLeaderboard(): Array<{
  name: string;
  success_rate: number;
  tasks_completed: number;
}>
```

---

### `runAgent(task, executor)`

**Module:** `agents`

Full agent lifecycle: pick → spawn → execute → record → complete.

```typescript
async function runAgent(
  task: string,
  executor: (agent: string, task: string) => Promise<boolean>
): Promise<{
  agent: string;
  succeeded: boolean;
  duration_ms: number;
}>
```

---

### `suggestAgent(task)`

**Module:** `agents`

Get the best agent name for a task without spawning.

```typescript
function suggestAgent(task: string): string | null
```

---

## Money (Task Pricing)

### `TASK_TYPES`

**Module:** `money/pricing`

Array of available task type keys.

```typescript
const TASK_TYPES: TaskType[]
// → ['code-gen', 'review', 'bugfix', 'docs']
```

---

### `estimateComplexity(description)`

**Module:** `money/pricing`

Estimate task complexity from description text (1-10 scale).

```typescript
function estimateComplexity(description: string): number
```

**Heuristics:**
- Length: >50 (+1), >150 (+1), >300 (+2)
- Complex keywords: refactor, migrate, architecture, security, performance, parallel, concurrent (+1 each)
- Simple keywords: fix typo, rename, format, comment, update version (-1 each, min 1)

---

### `complexityMultiplier(complexity)`

**Module:** `money/pricing`

Convert complexity score to a price multiplier.

```typescript
function complexityMultiplier(complexity: number): number
// Linear: 1 → 1.0x, 10 → 2.5x
```

---

### `calculatePrice(type, description)`

**Module:** `money/pricing`

Full price breakdown for a task.

```typescript
function calculatePrice(type: TaskType, description: string): PriceBreakdown

interface PriceBreakdown {
  type: TaskType;
  label: string;
  baseCredits: number;
  complexity: number;       // 1-10
  multiplier: number;       // 1.0-2.5
  totalCredits: number;     // base × multiplier
}
```

---

### `executeTask(type, description, handler)`

**Module:** `money/execute`

Execute a task with full lifecycle management.

```typescript
async function executeTask(
  type: TaskType,
  description: string,
  handler: (task: Task) => Promise<string>
): Promise<ExecutionResult>

interface ExecutionResult {
  task: Task;
  success: boolean;
  duration: number;         // milliseconds
}
```

---

### `createTask(type, description)`

**Module:** `money/execute`

Create a task object without executing (for queuing).

```typescript
function createTask(type: TaskType, description: string): Task
```

---

### `TASK_CONFIG`

**Module:** `money`

The raw task configuration from `tasks.json`.

```typescript
const TASK_CONFIG: {
  version: string;
  taskTypes: Record<TaskType, { label: string; baseCredits: number; description: string }>;
}
```

---

## Personality

### `getVoice(context)`

**Module:** `personality/voice`

Get voice context for a situation.

```typescript
function getVoice(context: Situation): VoiceContext

interface Situation {
  event: 'error' | 'success' | 'idle' | 'work' | 'frustration' | 'celebration' | 'routine';
  severity?: 'low' | 'normal' | 'critical';
  waiting?: boolean;
}

interface VoiceContext {
  tone: 'serious' | 'brief' | 'playful' | 'focused' | 'empathetic';
  style: 'concise' | 'verbose' | 'warm' | 'cold' | 'dry';
  humor: 'none' | 'minimal' | 'light' | 'full';
  emoji: 'none' | 'rare' | 'moderate' | 'heavy';
}
```

---

### `shouldJoke(context)`

**Module:** `personality/voice`

Check if humor is appropriate for this situation.

```typescript
function shouldJoke(context: Situation): boolean
```

---

### `getVoicePrefix(context)`

**Module:** `personality/voice`

Get a one-liner prefix based on voice tone.

```typescript
function getVoicePrefix(context: Situation): string
```

Returns empathetic prefix for frustration, empty string for all others.

---

### `respond(situation, message)`

**Module:** `personality`

Apply voice context to a response string.

```typescript
function respond(situation: Situation, message: string): string
```

---

### `greet(timeOfDay?)`

**Module:** `personality`

Time-aware greeting.

```typescript
function greet(timeOfDay?: 'morning' | 'afternoon' | 'evening'): string
```

Auto-detects from system clock if not specified.

---

### `farewell()`

**Module:** `personality`

Random farewell message.

```typescript
function farewell(): string
```

---

### `getJoke()`

**Module:** `personality`

Random programming joke.

```typescript
function getJoke(): string
```
