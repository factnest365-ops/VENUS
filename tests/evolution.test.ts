import { describe, it, expect, beforeEach } from 'vitest';
import { EvolutionEngine } from '../core/evolution.js';

describe('EvolutionEngine', () => {
  let engine: EvolutionEngine;

  beforeEach(() => {
    engine = new EvolutionEngine();
  });

  it('should initialize with default fitness score', () => {
    expect(engine.fitness).toBe(0);
  });

  it('should record a mutation', () => {
    engine.mutate({ type: 'prompt', change: 'add reasoning step' });
    expect(engine.mutations.length).toBe(1);
    expect(engine.mutations[0].type).toBe('prompt');
  });

  it('should evaluate fitness from task outcomes', () => {
    engine.recordOutcome({ success: true, latency: 100 });
    engine.recordOutcome({ success: true, latency: 150 });
    engine.recordOutcome({ success: false, latency: 200 });

    expect(engine.fitness).toBeGreaterThan(0);
    expect(engine.fitness).toBeLessThan(1);
  });

  it('should select best mutation based on fitness delta', () => {
    engine.mutate({ type: 'tool', change: 'add search' });
    engine.mutate({ type: 'prompt', change: 'simplify output' });

    const best = engine.selectBest();
    expect(best).toBeDefined();
    expect(['prompt', 'tool']).toContain(best.type);
  });

  it('should rollback mutation on regression', () => {
    engine.mutate({ type: 'memory', change: 'increase context' });
    const before = engine.fitness;

    engine.recordOutcome({ success: false, latency: 500 });
    engine.rollback();

    expect(engine.mutations.length).toBe(0);
  });
});
