/**
 * Memory forgetting — prune memories below confidence threshold.
 *
 * Memories scoring below the threshold (default 0.3) are evicted,
 * simulating biological forgetting of low-salience information.
 */

import { type Memory, scoreMemory } from './confidence.js';

const DEFAULT_THRESHOLD = 0.3;

/**
 * Remove memories whose confidence score falls below the threshold.
 * Returns pruned memories sorted by confidence descending.
 */
export function pruneMemories(
  memories: Memory[],
  threshold: number = DEFAULT_THRESHOLD,
): Memory[] {
  return memories
    .filter(m => scoreMemory(m) >= threshold)
    .sort((a, b) => scoreMemory(b) - scoreMemory(a));
}
