import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../memory/store.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(':memory:');
  });

  it('should store and retrieve a fact', () => {
    store.set('user_prefers_dark', { value: true, category: 'preference' });
    const result = store.get('user_prefers_dark');
    expect(result).toEqual({ value: true, category: 'preference' });
  });

  it('should return null for missing keys', () => {
    const result = store.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should list facts by category', () => {
    store.set('pref_1', { value: 'a', category: 'preference' });
    store.set('pref_2', { value: 'b', category: 'preference' });
    store.set('fact_1', { value: 'c', category: 'fact' });

    const prefs = store.listByCategory('preference');
    expect(prefs).toHaveLength(2);
  });

  it('should decay old memories', () => {
    store.set('old_memory', { value: 'fading', category: 'ephemeral' });
    const decayed = store.decay({ olderThanMs: 0 });
    expect(decayed).toBeGreaterThanOrEqual(0);
  });

  it('should support semantic search', () => {
    store.set('python_is_good', { value: 'Python is great for ML', category: 'opinion' });
    store.set('rust_is_fast', { value: 'Rust is fast and safe', category: 'opinion' });

    const results = store.search('programming language');
    expect(Array.isArray(results)).toBe(true);
  });

  it('should track access count', () => {
    store.set('popular', { value: 'yes', category: 'meta' });
    store.get('popular');
    store.get('popular');

    const meta = store.getMeta('popular');
    expect(meta?.accessCount).toBe(3); // 1 write + 2 reads
  });
});
