import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Pi integration
import { initVENUS, getContext } from '../pi/index';

// Agents
import { pickBestAgent, spawnAgent, completeSpawn } from '../agents/spawn';
import { recordResult, getLeaderboard } from '../agents/evaluate';
import { runAgent } from '../agents/index';

// Money
import { calculatePrice, createTask, executeTask } from '../money/index';

// Personality
import { getVoice, shouldJoke } from '../personality/voice';
import { greet, farewell, getJoke, respond } from '../personality/index';

// Memory
import { logEvent, getStats } from '../memory/recall';

// Auto-spawn
import { analyzeComplexity, autoSpawn } from '../agents/auto-spawn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DB = join(__dirname, 'test-integration.db');
const ACTIVE_PATH = join(__dirname, '..', 'agents', 'active.json');

beforeAll(async () => {
  // Reset active.json for clean state
  writeFileSync(ACTIVE_PATH, '[]');
  await initVENUS(TEST_DB);
});

afterAll(() => {
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }
  // Clean up active.json
  writeFileSync(ACTIVE_PATH, '[]');
});

// ── Full Lifecycle Test ──────────────────────────────────────────────

describe('Full system integration', () => {
  it('1) initVENUS loads rules + patterns + memory', () => {
    const ctx = getContext();
    expect(ctx.ready).toBe(true);
    expect(ctx.rules.length).toBeGreaterThan(0);
    expect(ctx.patterns).toBeDefined();
    expect(typeof ctx.memoryStats.events).toBe('number');
  });

  it('2) Create agent team — pickBestAgent finds a match', () => {
    const agent = pickBestAgent('write some code');
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('coder');
  });

  it('3) Execute task via runAgent end-to-end', async () => {
    const result = await runAgent('implement feature', async (_agent, _task) => {
      return true; // mock success
    });

    expect(result.succeeded).toBe(true);
    expect(result.agent).toBe('coder');
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('4) Record result updates leaderboard', () => {
    recordResult({
      agent: 'coder',
      task_id: 'integration-test-1',
      succeeded: true,
      duration_ms: 42,
    });

    const board = getLeaderboard();
    expect(board.length).toBeGreaterThan(0);

    const coder = board.find(a => a.name === 'coder');
    expect(coder).toBeDefined();
    expect(coder!.tasks_completed).toBeGreaterThanOrEqual(1);
  });

  it('5) Complexity analysis scores tasks correctly', () => {
    const simple = analyzeComplexity('write code');
    const complex = analyzeComplexity('migrate distributed database with security audit');

    expect(simple.label).toMatch(/trivial|simple/);
    expect(complex.label).toMatch(/complex|critical/);
    expect(complex.score).toBeGreaterThan(simple.score);
  });

  it('6) Pricing calculates correctly', () => {
    const price = calculatePrice('bugfix', 'simple task', 1);
    // calculatePrice returns a PriceBreakdown object
    expect(price).toHaveProperty('totalCredits');
    expect(price.totalCredits).toBeGreaterThan(0);
  });

  it('7) Personality responds contextually', () => {
    const errorVoice = getVoice({ event: 'error' });
    expect(errorVoice.tone).toBe('serious');
    expect(shouldJoke({ event: 'error' })).toBe(false);

    const idleVoice = getVoice({ event: 'idle' });
    expect(idleVoice.tone).toBe('playful');

    const greeting = greet();
    expect(typeof greeting).toBe('string');
    expect(greeting.length).toBeGreaterThan(0);

    const bye = farewell();
    expect(typeof bye).toBe('string');

    const joke = getJoke();
    expect(typeof joke).toBe('string');
  });

  it('8) Memory logs events and reports stats', () => {
    logEvent('integration', 'test event', 'success');
    const stats = getStats();
    expect(stats.events).toBeGreaterThanOrEqual(1);
  });

  it('9) AutoSpawn orchestrates full lifecycle', async () => {
    // Ensure clean active state
    writeFileSync(ACTIVE_PATH, '[]');

    const result = await autoSpawn(
      'implement new feature',
      async (_agent, _task) => true,
    );

    expect(result.succeeded).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.complexity).toBeDefined();
    expect(typeof result.complexity.label).toBe('string');
  });

  it('10) Context is immutable between calls', () => {
    const a = getContext();
    const b = getContext();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

// ── Cross-module wiring ─────────────────────────────────────────────

describe('Cross-module wiring', () => {
  it('personality respects error context in respond()', () => {
    const result = respond({ event: 'error' }, 'something broke');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('full pipeline: price → execute → record → leaderboard', async () => {
    // Price
    const price = calculatePrice('bugfix', 'fix login error', 2);
    expect(price.totalCredits).toBeGreaterThan(0);

    // Execute
    const task = createTask('bugfix', 'fix login error');
    expect(task.type).toBe('bugfix');

    // Record
    recordResult({
      agent: 'coder',
      task_id: 'pipeline-test',
      succeeded: true,
      duration_ms: 100,
    });

    const board = getLeaderboard();
    expect(board.some(a => a.name === 'coder')).toBe(true);
  });
});
