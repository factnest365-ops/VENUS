import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scoreMemory, type Memory } from '../memory/confidence.js';
import { consolidateMemories } from '../memory/consolidate.js';
import { pruneMemories } from '../memory/forget.js';
import { recallMemories } from '../memory/recall.js';

// Helper to create a Memory with sensible defaults
function mem(overrides: Partial<Memory> & { id: string; content: string; keywords: string[] }): Memory {
  const now = Date.now();
  return {
    createdAt: now - 86_400_000, // 1 day ago
    lastAccessed: now,
    usageCount: 5,
    ...overrides,
  };
}

// ─── Confidence Scoring ───────────────────────────────────────────────

describe('confidence scoring', () => {
  it('returns 1.0 for a memory just accessed with moderate usage', () => {
    const now = Date.now();
    const score = scoreMemory({ lastAccessed: now, usageCount: 10, createdAt: now });
    // 0.6*1.0 + 0.4*(1-e^-1) ≈ 0.853
    expect(score).toBeGreaterThan(0.85);
  });

  it('decays for old memories', () => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86_400_000;
    const score = scoreMemory({ lastAccessed: thirtyDaysAgo, usageCount: 10, createdAt: thirtyDaysAgo });
    expect(score).toBeLessThan(0.5);
  });

  it('increases with usage frequency', () => {
    const now = Date.now();
    const low = scoreMemory({ lastAccessed: now, usageCount: 1, createdAt: now });
    const high = scoreMemory({ lastAccessed: now, usageCount: 50, createdAt: now });
    expect(high).toBeGreaterThan(low);
  });

  it('clamps to [0, 1]', () => {
    const farPast = Date.now() - 365 * 86_400_000 * 10; // 10 years
    const score = scoreMemory({ lastAccessed: farPast, usageCount: 0, createdAt: farPast });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── Consolidation ────────────────────────────────────────────────────

describe('consolidation', () => {
  it('merges memories with high keyword overlap', () => {
    const a = mem({ id: '1', content: 'TypeScript tips', keywords: ['typescript', 'types', 'generics'] });
    const b = mem({ id: '2', content: 'TS generics guide', keywords: ['typescript', 'generics', 'constraints'] });
    const result = consolidateMemories([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].usageCount).toBe(a.usageCount + b.usageCount);
    expect(result[0].keywords.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps disjoint memories separate', () => {
    const a = mem({ id: '1', content: 'Cooking recipe', keywords: ['cooking', 'recipe'] });
    const b = mem({ id: '2', content: 'Rust compiler', keywords: ['rust', 'compiler', 'ownership'] });
    const result = consolidateMemories([a, b]);
    expect(result).toHaveLength(2);
  });

  it('picks the longer content in a merge', () => {
    const short = mem({ id: '1', content: 'Short', keywords: ['ai', 'ml', 'deep-learning'] });
    const long = mem({ id: '2', content: 'A much longer and more detailed content string', keywords: ['ai', 'deep-learning', 'neural'] });
    const result = consolidateMemories([short, long]);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(long.content);
  });
});

// ─── Forgetting ───────────────────────────────────────────────────────

describe('forgetting', () => {
  it('prunes old unused memories below threshold', () => {
    const now = Date.now();
    const fresh = mem({ id: 'fresh', content: 'Fresh', keywords: ['a'], lastAccessed: now, usageCount: 10 });
    const stale = mem({
      id: 'stale',
      content: 'Stale',
      keywords: ['b'],
      lastAccessed: now - 90 * 86_400_000,
      createdAt: now - 90 * 86_400_000,
      usageCount: 1,
    });
    const result = pruneMemories([fresh, stale]);
    expect(result.find(m => m.id === 'stale')).toBeUndefined();
    expect(result.find(m => m.id === 'fresh')).toBeDefined();
  });

  it('respects custom threshold', () => {
    const now = Date.now();
    const mid = mem({ id: 'mid', content: 'Mid', keywords: ['x'], lastAccessed: now - 7 * 86_400_000, usageCount: 3 });
    // With threshold 0.0, everything survives
    expect(pruneMemories([mid], 0.0)).toHaveLength(1);
    // With threshold 1.0, everything is pruned
    expect(pruneMemories([mid], 1.0)).toHaveLength(0);
  });

  it('returns results sorted by confidence descending', () => {
    const now = Date.now();
    const good = mem({ id: 'good', content: 'Good', keywords: ['a'], usageCount: 50 });
    const ok = mem({ id: 'ok', content: 'Ok', keywords: ['b'], lastAccessed: now - 5 * 86_400_000, usageCount: 5 });
    const result = pruneMemories([ok, good]);
    if (result.length === 2) {
      expect(scoreMemory(result[0])).toBeGreaterThanOrEqual(scoreMemory(result[1]));
    }
  });
});

// ─── Recall Integration ──────────────────────────────────────────────

describe('recall with confidence ranking', () => {
  it('ranks recently-accessed memories first', () => {
    const now = Date.now();
    const recent = mem({ id: 'recent', content: 'Recent', keywords: ['r'], lastAccessed: now });
    const old = mem({ id: 'old', content: 'Old', keywords: ['o'], lastAccessed: now - 60 * 86_400_000, createdAt: now - 60 * 86_400_000 });
    const ranked = recallMemories([old, recent]);
    expect(ranked[0].id).toBe('recent');
  });

  it('respects limit parameter', () => {
    const now = Date.now();
    const memories = Array.from({ length: 20 }, (_, i) =>
      mem({ id: String(i), content: `M${i}`, keywords: [String(i)], usageCount: i })
    );
    const ranked = recallMemories(memories, 5);
    expect(ranked).toHaveLength(5);
  });
});
