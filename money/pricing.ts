import tasks from "./tasks.json";

export type TaskType = keyof typeof tasks.taskTypes;

export interface PriceBreakdown {
  type: TaskType;
  label: string;
  baseCredits: number;
  complexity: number;
  multiplier: number;
  totalCredits: number;
}

/**
 * Estimate complexity from a task description.
 * Returns 1-10 scale based on heuristics.
 */
export function estimateComplexity(description: string): number {
  const len = description.length;
  let score = 1;

  // Length heuristic
  if (len > 50) score += 1;
  if (len > 150) score += 1;
  if (len > 300) score += 2;

  // Keyword heuristics
  const complex = ["refactor", "migrate", "architecture", "security", "performance", "parallel", "concurrent"];
  const simple = ["fix typo", "rename", "format", "comment", "update version"];

  const lower = description.toLowerCase();
  for (const kw of complex) {
    if (lower.includes(kw)) score += 1;
  }
  for (const kw of simple) {
    if (lower.includes(kw)) score = Math.max(1, score - 1);
  }

  return Math.min(10, Math.max(1, score));
}

/**
 * Compute multiplier from complexity score.
 * Linear: complexity 1 = 1x, complexity 10 = 2.5x
 */
export function complexityMultiplier(complexity: number): number {
  return 1 + ((complexity - 1) / 9) * 1.5;
}

/**
 * Calculate full price breakdown for a task.
 */
export function calculatePrice(type: TaskType, description: string): PriceBreakdown {
  const task = tasks.taskTypes[type];
  if (!task) {
    throw new Error(`Unknown task type: ${type}`);
  }

  const complexity = estimateComplexity(description);
  const multiplier = complexityMultiplier(complexity);
  const totalCredits = Math.round(task.baseCredits * multiplier * 100) / 100;

  return {
    type,
    label: task.label,
    baseCredits: task.baseCredits,
    complexity,
    multiplier: Math.round(multiplier * 100) / 100,
    totalCredits,
  };
}

export const TASK_TYPES = Object.keys(tasks.taskTypes) as TaskType[];
