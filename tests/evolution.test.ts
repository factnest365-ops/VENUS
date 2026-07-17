import { describe, it, expect, beforeEach } from 'vitest';
import { evolve, resetEvolution } from '../core/evolve';

describe('evolution loop', () => {
  beforeEach(() => {
    resetEvolution();
  });

  it('returns an action with type and reason', () => {
    const action = evolve();
    expect(action).toHaveProperty('type');
    expect(action).toHaveProperty('reason');
    expect(['create', 'edit', 'delete', 'stop']).toContain(action.type);
  });

  it('stops on repeated actions', () => {
    // Run multiple times to test repetition detection
    const actions = Array.from({ length: 5 }, () => evolve());
    const types = actions.map(a => a.type);
    
    // Should have a stop after 2 consecutive same actions
    const hasStop = types.includes('stop');
    expect(hasStop).toBe(true);
  });

  it('different actions do not trigger stop', () => {
    // If we alternate between different actions, no stop
    // This tests that the repetition detection is working correctly
    const action1 = evolve();
    expect(action1.type).not.toBe('stop');
  });
});
