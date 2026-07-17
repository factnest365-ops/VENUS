/**
 * Memory consolidation — merge memories with high keyword overlap.
 *
 * Two memories are candidates for merging when they share ≥50% of their
 * combined unique keywords (Jaccard similarity). The merged memory inherits
 * the most recent lastAccessed, sums usageCount, and picks the longer content.
 */

import { type Memory } from './confidence.js';

const JACCARD_THRESHOLD = 0.5;

/**
 * Compute Jaccard similarity between two keyword sets.
 */
function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a.map(k => k.toLowerCase()));
  const setB = new Set(b.map(k => k.toLowerCase()));
  let intersection = 0;
  for (const k of setA) {
    if (setB.has(k)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Merge two memories into one.
 */
function mergePair(a: Memory, b: Memory): Memory {
  const newer = a.lastAccessed >= b.lastAccessed ? a : b;
  const older = a.lastAccessed >= b.lastAccessed ? b : a;

  // Deduplicate keywords
  const kwSet = new Set([
    ...a.keywords.map(k => k.toLowerCase()),
    ...b.keywords.map(k => k.toLowerCase()),
  ]);

  return {
    id: newer.id,
    content: newer.content.length >= older.content.length ? newer.content : older.content,
    keywords: [...kwSet],
    createdAt: Math.min(a.createdAt, b.createdAt),
    lastAccessed: newer.lastAccessed,
    usageCount: a.usageCount + b.usageCount,
  };
}

/**
 * Find all merge pairs in the memory list (greedy, no double-merge).
 */
export function consolidateMemories(memories: Memory[]): Memory[] {
  const used = new Set<number>();
  const merged: Memory[] = [];

  for (let i = 0; i < memories.length; i++) {
    if (used.has(i)) continue;

    let current = memories[i];
    for (let j = i + 1; j < memories.length; j++) {
      if (used.has(j)) continue;

      if (jaccard(current.keywords, memories[j].keywords) >= JACCARD_THRESHOLD) {
        current = mergePair(current, memories[j]);
        used.add(j);
      }
    }

    merged.push(current);
  }

  return merged;
}
