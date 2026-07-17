/**
 * Memory confidence scoring — 0 to 1 based on recency + usage frequency.
 *
 * Formula:
 *   recencyScore = e^(-λ * daysSinceAccess)          (1.0 when just accessed, decays over days)
 *   frequencyScore = 1 - e^(-usageCount / τ)          (saturates around τ uses)
 *   confidence = 0.6 * recencyScore + 0.4 * frequencyScore
 *
 * Decay constant λ = 0.05 → half-life ≈ 14 days
 * Saturation τ = 10 uses
 */

const HALF_LIFE_DAYS = 14;
const LAMBDA = Math.LN2 / HALF_LIFE_DAYS;
const TAU = 10;

export interface Memory {
  id: string;
  content: string;
  keywords: string[];
  createdAt: number;     // epoch ms
  lastAccessed: number;  // epoch ms
  usageCount: number;
}

export function scoreMemory(memory: {
  lastAccessed: number;
  usageCount: number;
  createdAt: number;
}): number {
  const now = Date.now();
  const msPerDay = 86_400_000;
  const daysSinceAccess = Math.max(0, (now - memory.lastAccessed) / msPerDay);
  const daysSinceCreated = Math.max(0, (now - memory.createdAt) / msPerDay);

  // If never accessed separately, use creation time
  const effectiveDays = memory.lastAccessed === memory.createdAt
    ? daysSinceCreated
    : daysSinceAccess;

  const recencyScore = Math.exp(-LAMBDA * effectiveDays);
  const frequencyScore = 1 - Math.exp(-memory.usageCount / TAU);

  const confidence = 0.6 * recencyScore + 0.4 * frequencyScore;
  return Math.round(confidence * 1000) / 1000; // 3 decimal places
}
