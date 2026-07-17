# Changelog

All notable changes to VENUS.

---

## [0.1.0] — 2026-07-17

### Phase 1 — Core Evolution
- Evolution engine with rules/patterns/log decision loop
- File-based state: `rules.md`, `patterns.md`, `log.md`
- Repetition detection and STOP token
- `evolve()` action types: create, edit, delete, stop

### Phase 2 — Memory
- SQLite persistence via sql.js (WASM)
- `initDB()`, `logEvent()`, `searchEvents()`, `getStats()`
- Pattern storage with frequency tracking
- Rule update with timestamps
- Weighted average pattern success rates

### Phase 3 — Agents
- Agent registry (`registry.json`) with 5 base agents
- Keyword-based task matching
- Spawn concurrency control (max 5 concurrent)
- EMA success rate scoring (0.8 decay)
- `runAgent()` full lifecycle: pick → spawn → execute → record → complete
- Leaderboard and batch recording

### Phase 3.5 — Personality
- Voice context system (7 situations × 4 voice dimensions)
- Situation-aware overrides (critical error → cold, low error → warm)
- Time-of-day greetings
- Programming jokes
- `respond()` with voice prefix injection

### Phase 4 — Money Module
- Task type registry (`tasks.json`): code-gen, review, bugfix, docs
- Complexity estimation from description heuristics
- Linear complexity multiplier (1.0x–2.5x)
- `calculatePrice()` full breakdown
- `executeTask()` with lifecycle, timing, and error handling
- `createTask()` for queueing

### Phase 4 — Documentation
- `docs/README.md` — comprehensive guide with examples
- `docs/ARCHITECTURE.md` — system design and data flow
- `docs/API.md` — full API reference for all exports
- `docs/CONTRIBUTING.md` — extension guide

---

## Roadmap

### [0.2.0] — Planned
- [ ] Zod schema validation for all inputs
- [ ] Agent hot-reload (registry changes without restart)
- [ ] Pattern extraction from log entries
- [ ] Cost tracking and budget caps
- [ ] CLI interactive mode

### [0.3.0] — Planned
- [ ] Plugin system for custom agents
- [ ] Web dashboard for leaderboard and stats
- [ ] Multi-agent task decomposition
- [ ] Persistent pattern learning from execution results
- [ ] Export/import memory snapshots
