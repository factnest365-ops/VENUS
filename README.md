<p align="center">
  <img src="https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge" alt="build">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="license">
  <img src="https://img.shields.io/badge/npm-0.1.0-orange?style=for-the-badge" alt="npm version">
</p>

<h1 align="center">VENUS</h1>

<p align="center"><b>Self-improving AI agent system</b></p>

<p align="center">Mid model + perfect structure = AGI-level performance.</p>

---

## Install

```bash
git clone https://github.com/venus/venus.git && cd venus
npm install
```

That's it. One minute, zero config.

## Quick Start

```bash
# Run the evolution loop
npx tsx index.ts

# Get a greeting
npx tsx index.ts greet

# Show system status
npx tsx index.ts status
```

## Usage Examples

### 1. Run the Evolution Loop

```ts
import { evolve } from 'venus';

// Reads rules, patterns, and logs — decides the next action
const action = evolve();
console.log(action);
// { type: 'create', target: 'docs/API.md', reason: 'Pattern detected...' }
```

### 2. Spawn and Evaluate Agents

```ts
import { spawnAgent, runAgent, recordResult, getLeaderboard } from 'venus';

// Spawn the best agent for a task
const agent = spawnAgent('implement dark mode');
console.log(`Spawned: ${agent}`);

// After completion, record the result
recordResult('coder', true);

// Check the leaderboard
const board = getLeaderboard();
board.forEach(a => console.log(`${a.name}: ${(a.success_rate * 100).toFixed(0)}%`));
```

### 3. Query Memory

```ts
import { initDB, logEvent, searchEvents, getStats } from 'venus';

await initDB();

// Log an event
logEvent('deployment', { service: 'api', version: '1.2.0' });

// Search past events
const results = searchEvents('deployment');
console.log(results);

// Get system stats
const stats = getStats();
console.log(`${stats.events} events, ${stats.patterns} patterns`);
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        VENUS                            │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│   core   │  agents  │  memory  │ money    │ personality │
│          │          │          │          │             │
│ evolve   │ spawn    │ recall   │ pricing  │ voice       │
│ patterns │ evaluate │ forget   │ scoping  │ soul        │
│ rules    │ registry │ confide. │ invoice  │ humor       │
│ log      │ auto     │ consol.  │ execute  │ respond     │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│                    SQLite (memory)                       │
└─────────────────────────────────────────────────────────┘

Evolution Loop:
  ┌────────┐    ┌──────────┐    ┌────────┐    ┌────────┐
  │ Rules  │───▶│  evolve  │───▶│  act   │───▶│  log   │──┐
  └────────┘    └──────────┘    └────────┘    └────────┘  │
       ▲                                                   │
       └───────────────────────────────────────────────────┘

Agent Pipeline:
  Task ──▶ spawn ──▶ run ──▶ evaluate ──▶ leaderboard
                           ▼
                      memory (patterns, confidence)
```

## Project Structure

```
venus/
├── core/          Evolution engine, rules, patterns
├── agents/        Agent registry, spawning, evaluation
├── memory/        SQLite-backed event & pattern storage
├── money/         Pricing, scoping, invoicing, execution
├── personality/   Voice, humor, soul
├── tests/         Vitest test suite
└── index.ts       CLI entrypoint & public API
```

## License

[MIT](LICENSE) © 2026 Bhavy
