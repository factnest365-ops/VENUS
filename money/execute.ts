import { TaskType, calculatePrice, PriceBreakdown } from "./pricing";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  status: TaskStatus;
  pricing: PriceBreakdown;
  result?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface ExecutionResult {
  task: Task;
  success: boolean;
  duration: number;
}

let taskCounter = 0;

function generateId(): string {
  taskCounter++;
  return `task_${Date.now()}_${taskCounter}`;
}

/**
 * Execute a task. The handler is injected — this module owns
 * lifecycle, pricing, and error handling.
 */
export async function executeTask(
  type: TaskType,
  description: string,
  handler: (task: Task) => Promise<string>,
): Promise<ExecutionResult> {
  const pricing = calculatePrice(type, description);
  const task: Task = {
    id: generateId(),
    type,
    description,
    status: "running",
    pricing,
    createdAt: Date.now(),
  };

  const start = performance.now();

  try {
    task.result = await handler(task);
    task.status = "completed";
    task.completedAt = Date.now();
  } catch (err: any) {
    task.status = "failed";
    task.error = err?.message ?? String(err);
    task.completedAt = Date.now();
  }

  const duration = performance.now() - start;

  return {
    task,
    success: task.status === "completed",
    duration: Math.round(duration * 100) / 100,
  };
}

/**
 * Create a task without executing it (for queuing).
 */
export function createTask(type: TaskType, description: string): Task {
  const pricing = calculatePrice(type, description);
  return {
    id: generateId(),
    type,
    description,
    status: "pending",
    pricing,
    createdAt: Date.now(),
  };
}
