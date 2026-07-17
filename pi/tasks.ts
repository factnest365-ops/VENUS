/**
 * VENUS Pi Task System
 *
 * Real-world task execution with queue, priority, status tracking, and retry logic.
 */

import { execSync, exec as execCb } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { promisify } from 'util';

const execAsync = promisify(execCb);

// ── Types ────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type TaskType = 'shell' | 'git' | 'npm' | 'file' | 'custom';

export interface Task {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Task type */
  type: TaskType;
  /** Current status */
  status: TaskStatus;
  /** Priority level */
  priority: TaskPriority;
  /** The command or operation to execute */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Current retry count */
  retryCount: number;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** ISO timestamp of completion (if done) */
  completedAt?: string;
  /** Execution result */
  result?: TaskResult;
  /** Error if failed */
  error?: string;
  /** Timeout in ms (default: 30000) */
  timeout?: number;
  /** Callback hook name */
  onComplete?: string;
}

export interface TaskResult {
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution duration in ms */
  duration: number;
}

export interface TaskQueue {
  /** Pending tasks sorted by priority */
  tasks: Task[];
  /** Currently running task */
  running: Task | null;
  /** Completed tasks (last N) */
  completed: Task[];
  /** Maximum concurrent tasks */
  maxConcurrent: number;
  /** Whether queue is processing */
  processing: boolean;
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 30_000;
const MAX_COMPLETED_HISTORY = 100;

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ── ID Generator ─────────────────────────────────────────────────────

let taskCounter = 0;

function generateTaskId(): string {
  return `task-${Date.now()}-${(taskCounter++).toString(36)}`;
}

// ── Task Creation ────────────────────────────────────────────────────

/**
 * Create a new task.
 */
export function createTask(
  name: string,
  type: TaskType,
  command: string,
  options?: {
    args?: string[];
    cwd?: string;
    priority?: TaskPriority;
    maxRetries?: number;
    timeout?: number;
    onComplete?: string;
  },
): Task {
  return {
    id: generateTaskId(),
    name,
    type,
    status: 'pending',
    priority: options?.priority ?? 'normal',
    command,
    args: options?.args,
    cwd: options?.cwd,
    maxRetries: options?.maxRetries ?? 3,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeout: options?.timeout ?? DEFAULT_TIMEOUT,
    onComplete: options?.onComplete,
  };
}

/**
 * Create a shell task.
 */
export function shellTask(
  name: string,
  command: string,
  options?: { cwd?: string; priority?: TaskPriority; maxRetries?: number },
): Task {
  return createTask(name, 'shell', command, options);
}

/**
 * Create a git task.
 */
export function gitTask(
  name: string,
  args: string[],
  options?: { cwd?: string; priority?: TaskPriority; maxRetries?: number },
): Task {
  return createTask(name, 'git', 'git', { ...options, args });
}

/**
 * Create an npm task.
 */
export function npmTask(
  name: string,
  script: string,
  options?: { cwd?: string; priority?: TaskPriority; maxRetries?: number },
): Task {
  return createTask(name, 'npm', 'npm', { ...options, args: ['run', script] });
}

/**
 * Create a file read task.
 */
export function readFileTask(
  name: string,
  filePath: string,
  options?: { priority?: TaskPriority },
): Task {
  return createTask(name, 'file', `cat`, { ...options, args: [filePath] });
}

/**
 * Create a file write task.
 */
export function writeFileTask(
  name: string,
  filePath: string,
  content: string,
  options?: { priority?: TaskPriority },
): Task {
  // Store content in args for special handling
  return createTask(name, 'file', 'write', {
    ...options,
    args: [filePath, content],
  });
}

// ── Queue Management ─────────────────────────────────────────────────

/**
 * Create a new task queue.
 */
export function createQueue(maxConcurrent?: number): TaskQueue {
  return {
    tasks: [],
    running: null,
    completed: [],
    maxConcurrent: maxConcurrent ?? 1,
    processing: false,
  };
}

/**
 * Add a task to the queue.
 */
export function enqueue(queue: TaskQueue, task: Task): TaskQueue {
  const tasks = [...queue.tasks, task].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  return { ...queue, tasks };
}

/**
 * Get next task from queue (highest priority, non-blocked).
 */
export function dequeue(queue: TaskQueue): { task: Task; queue: TaskQueue } | null {
  if (queue.tasks.length === 0) return null;

  const [task, ...rest] = queue.tasks;
  return {
    task,
    queue: { ...queue, tasks: rest },
  };
}

/**
 * Get queue statistics.
 */
export function getQueueStats(queue: TaskQueue): QueueStats {
  return {
    pending: queue.tasks.length,
    running: queue.running ? 1 : 0,
    completed: queue.completed.filter((t) => t.status === 'completed').length,
    failed: queue.completed.filter((t) => t.status === 'failed').length,
    total:
      queue.tasks.length +
      (queue.running ? 1 : 0) +
      queue.completed.length,
  };
}

// ── Task Execution ───────────────────────────────────────────────────

/**
 * Execute a task synchronously.
 */
export function executeTaskSync(task: Task): Task {
  const start = Date.now();

  try {
    // Handle file write specially
    if (task.type === 'file' && task.command === 'write' && task.args) {
      const [filePath, content] = task.args;
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, content);
      return {
        ...task,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        result: {
          exitCode: 0,
          stdout: `Written to ${filePath}`,
          stderr: '',
          duration: Date.now() - start,
        },
      };
    }

    // Build command
    let fullCommand = task.command;
    if (task.args?.length) {
      fullCommand += ' ' + task.args.map((a) => `"${a}"`).join(' ');
    }

    const output = execSync(fullCommand, {
      cwd: task.cwd,
      timeout: task.timeout ?? DEFAULT_TIMEOUT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      ...task,
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: {
        exitCode: 0,
        stdout: output,
        stderr: '',
        duration: Date.now() - start,
      },
    };
  } catch (err: any) {
    const shouldRetry = task.retryCount < task.maxRetries;

    return {
      ...task,
      status: shouldRetry ? 'retrying' : 'failed',
      retryCount: task.retryCount + 1,
      updatedAt: new Date().toISOString(),
      error: err.message ?? String(err),
      result: {
        exitCode: err.status ?? 1,
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message ?? '',
        duration: Date.now() - start,
      },
    };
  }
}

/**
 * Execute a task asynchronously.
 */
export async function executeTask(task: Task): Promise<Task> {
  const start = Date.now();

  try {
    // Handle file write specially
    if (task.type === 'file' && task.command === 'write' && task.args) {
      const [filePath, content] = task.args;
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, content);
      return {
        ...task,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        result: {
          exitCode: 0,
          stdout: `Written to ${filePath}`,
          stderr: '',
          duration: Date.now() - start,
        },
      };
    }

    // Handle file read specially
    if (task.type === 'file' && task.command === 'cat' && task.args) {
      const filePath = task.args[0];
      const content = readFileSync(filePath, 'utf-8');
      return {
        ...task,
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        result: {
          exitCode: 0,
          stdout: content,
          stderr: '',
          duration: Date.now() - start,
        },
      };
    }

    // Build command
    let fullCommand = task.command;
    if (task.args?.length) {
      fullCommand += ' ' + task.args.map((a) => `"${a}"`).join(' ');
    }

    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd: task.cwd,
      timeout: task.timeout ?? DEFAULT_TIMEOUT,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      ...task,
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: {
        exitCode: 0,
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        duration: Date.now() - start,
      },
    };
  } catch (err: any) {
    const shouldRetry = task.retryCount < task.maxRetries;

    return {
      ...task,
      status: shouldRetry ? 'retrying' : 'failed',
      retryCount: task.retryCount + 1,
      updatedAt: new Date().toISOString(),
      error: err.message ?? String(err),
      result: {
        exitCode: err.code ?? 1,
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message ?? '',
        duration: Date.now() - start,
      },
    };
  }
}

// ── Queue Processing ─────────────────────────────────────────────────

/**
 * Process next task in queue.
 */
export async function processNext(queue: TaskQueue): Promise<TaskQueue> {
  if (queue.running) return queue;

  const next = dequeue(queue);
  if (!next) return queue;

  const { task, queue: updatedQueue } = next;
  const runningTask = { ...task, status: 'running' as const, updatedAt: new Date().toISOString() };

  const executed = await executeTask(runningTask);

  // Handle retry
  if (executed.status === 'retrying') {
    const retryTask = { ...executed, status: 'pending' as const };
    const retriedQueue = enqueue(updatedQueue, retryTask);
    return { ...retriedQueue, running: null };
  }

  // Move to completed
  const completed = [executed, ...updatedQueue.completed].slice(0, MAX_COMPLETED_HISTORY);

  return {
    ...updatedQueue,
    running: null,
    completed,
  };
}

/**
 * Process all tasks in queue until empty.
 */
export async function processAll(queue: TaskQueue): Promise<TaskQueue> {
  let current = { ...queue, processing: true };

  while (current.tasks.length > 0 || current.running) {
    current = await processNext(current);
  }

  return { ...current, processing: false };
}

/**
 * Cancel a pending task by ID.
 */
export function cancelTask(queue: TaskQueue, taskId: string): TaskQueue {
  const tasks = queue.tasks.filter((t) => t.id !== taskId);
  const cancelled = queue.tasks.find((t) => t.id === taskId);

  if (cancelled) {
    const cancelledTask: Task = {
      ...cancelled,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };
    const completed = [cancelledTask, ...queue.completed].slice(0, MAX_COMPLETED_HISTORY);
    return { ...queue, tasks, completed };
  }

  return queue;
}

/**
 * Clear completed tasks.
 */
export function clearCompleted(queue: TaskQueue): TaskQueue {
  return { ...queue, completed: [] };
}

// ── Utilities ────────────────────────────────────────────────────────

/**
 * Find a task by ID across all queue sections.
 */
export function findTask(queue: TaskQueue, taskId: string): Task | undefined {
  if (queue.running?.id === taskId) return queue.running;
  return (
    queue.tasks.find((t) => t.id === taskId) ??
    queue.completed.find((t) => t.id === taskId)
  );
}

/**
 * Get tasks by status.
 */
export function getTasksByStatus(queue: TaskQueue, status: TaskStatus): Task[] {
  const all = [...queue.tasks, ...(queue.running ? [queue.running] : []), ...queue.completed];
  return all.filter((t) => t.status === status);
}
