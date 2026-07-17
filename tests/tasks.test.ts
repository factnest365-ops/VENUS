import { describe, it, expect } from 'vitest';
import {
  createTask,
  shellTask,
  gitTask,
  npmTask,
  readFileTask,
  writeFileTask,
  createQueue,
  enqueue,
  dequeue,
  getQueueStats,
  executeTask,
  executeTaskSync,
  processNext,
  processAll,
  cancelTask,
  clearCompleted,
  findTask,
  getTasksByStatus,
  type Task,
  type TaskQueue,
} from '../pi/tasks';
import { existsSync, rmSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), '.venus-tasks-test');

describe('pi tasks', () => {
  describe('task creation', () => {
    it('creates a task with defaults', () => {
      const task = createTask('test', 'shell', 'echo hello');
      expect(task.id).toMatch(/^task-/);
      expect(task.name).toBe('test');
      expect(task.type).toBe('shell');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.maxRetries).toBe(3);
      expect(task.retryCount).toBe(0);
    });

    it('creates shell task', () => {
      const task = shellTask('echo', 'echo hello', { cwd: '/tmp' });
      expect(task.type).toBe('shell');
      expect(task.command).toBe('echo hello');
      expect(task.cwd).toBe('/tmp');
    });

    it('creates git task', () => {
      const task = gitTask('status', ['status']);
      expect(task.type).toBe('git');
      expect(task.command).toBe('git');
      expect(task.args).toEqual(['status']);
    });

    it('creates npm task', () => {
      const task = npmTask('build', 'build');
      expect(task.type).toBe('npm');
      expect(task.args).toEqual(['run', 'build']);
    });

    it('creates write file task', () => {
      const task = writeFileTask('write config', '/tmp/test.txt', 'hello');
      expect(task.type).toBe('file');
      expect(task.args).toEqual(['/tmp/test.txt', 'hello']);
    });
  });

  describe('queue management', () => {
    it('creates an empty queue', () => {
      const queue = createQueue();
      expect(queue.tasks).toEqual([]);
      expect(queue.running).toBeNull();
      expect(queue.completed).toEqual([]);
      expect(queue.maxConcurrent).toBe(1);
    });

    it('enqueues tasks sorted by priority', () => {
      let queue = createQueue();
      const low = createTask('low', 'shell', 'echo low', { priority: 'low' });
      const high = createTask('high', 'shell', 'echo high', { priority: 'high' });
      const critical = createTask('critical', 'shell', 'echo critical', { priority: 'critical' });

      queue = enqueue(queue, low);
      queue = enqueue(queue, high);
      queue = enqueue(queue, critical);

      expect(queue.tasks[0].priority).toBe('critical');
      expect(queue.tasks[1].priority).toBe('high');
      expect(queue.tasks[2].priority).toBe('low');
    });

    it('dequeues tasks in order', () => {
      let queue = createQueue();
      queue = enqueue(queue, createTask('first', 'shell', 'echo 1'));
      queue = enqueue(queue, createTask('second', 'shell', 'echo 2'));

      const result = dequeue(queue);
      expect(result).not.toBeNull();
      expect(result!.task.name).toBe('first');
      expect(result!.queue.tasks.length).toBe(1);
    });

    it('returns null when dequeuing empty queue', () => {
      const queue = createQueue();
      expect(dequeue(queue)).toBeNull();
    });

    it('reports queue stats', () => {
      let queue = createQueue();
      queue = enqueue(queue, createTask('a', 'shell', 'echo a'));
      queue = enqueue(queue, createTask('b', 'shell', 'echo b'));

      const stats = getQueueStats(queue);
      expect(stats.pending).toBe(2);
      expect(stats.running).toBe(0);
      expect(stats.total).toBe(2);
    });
  });

  describe('task execution', () => {
    it('executes shell command synchronously', () => {
      const task = shellTask('echo', 'echo hello');
      const result = executeTaskSync(task);
      expect(result.status).toBe('completed');
      expect(result.result?.stdout.trim()).toBe('hello');
      expect(result.result?.exitCode).toBe(0);
    });

    it('executes shell command asynchronously', async () => {
      const task = shellTask('echo', 'echo world');
      const result = await executeTask(task);
      expect(result.status).toBe('completed');
      expect(result.result?.stdout.trim()).toBe('world');
    });

    it('handles failed commands', async () => {
      const task = shellTask('fail', 'exit 1', { maxRetries: 0 });
      const result = await executeTask(task);
      expect(result.status).toBe('failed');
      expect(result.result?.exitCode).toBe(1);
    });

    it('retries on failure', async () => {
      const task = shellTask('retry', 'exit 1', { maxRetries: 2 });
      const result = await executeTask(task);
      expect(result.status).toBe('retrying');
      expect(result.retryCount).toBe(1);
    });

    it('writes files', async () => {
      if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true });
      }
      const filePath = join(TEST_DIR, 'test-write.txt');
      const task = writeFileTask('write', filePath, 'hello world');
      const result = await executeTask(task);
      expect(result.status).toBe('completed');

      const content = readFileSync(filePath, 'utf-8');
      expect(content).toBe('hello world');

      rmSync(TEST_DIR, { recursive: true, force: true });
    });
  });

  describe('queue processing', () => {
    it('processes next task', async () => {
      let queue = createQueue();
      queue = enqueue(queue, shellTask('echo', 'echo processed'));
      queue = await processNext(queue);

      expect(queue.running).toBeNull();
      expect(queue.completed.length).toBe(1);
      expect(queue.completed[0].status).toBe('completed');
    });

    it('retries failed tasks', async () => {
      let queue = createQueue();
      queue = enqueue(queue, shellTask('fail', 'exit 1', { maxRetries: 1 }));
      queue = await processNext(queue);

      // Task should be back in queue for retry
      expect(queue.tasks.length).toBe(1);
      expect(queue.tasks[0].retryCount).toBe(1);
    });

    it('processes all tasks', async () => {
      let queue = createQueue();
      queue = enqueue(queue, shellTask('a', 'echo a'));
      queue = enqueue(queue, shellTask('b', 'echo b'));
      queue = enqueue(queue, shellTask('c', 'echo c'));

      queue = await processAll(queue);
      expect(queue.completed.length).toBe(3);
      expect(queue.tasks.length).toBe(0);
    });

    it('cancels a pending task', () => {
      let queue = createQueue();
      const task = createTask('cancel-me', 'shell', 'echo nope');
      queue = enqueue(queue, task);
      queue = cancelTask(queue, task.id);

      expect(queue.tasks.length).toBe(0);
      expect(queue.completed.length).toBe(1);
      expect(queue.completed[0].status).toBe('cancelled');
    });

    it('clears completed tasks', async () => {
      let queue = createQueue();
      queue = enqueue(queue, shellTask('echo', 'echo done'));
      queue = await processAll(queue);
      queue = clearCompleted(queue);

      expect(queue.completed.length).toBe(0);
    });
  });

  describe('utilities', () => {
    it('finds task by id', () => {
      let queue = createQueue();
      const task = createTask('findme', 'shell', 'echo findme');
      queue = enqueue(queue, task);

      const found = findTask(queue, task.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('findme');
    });

    it('gets tasks by status', () => {
      let queue = createQueue();
      queue = enqueue(queue, shellTask('a', 'echo a'));
      queue = enqueue(queue, shellTask('b', 'echo b'));

      const pending = getTasksByStatus(queue, 'pending');
      expect(pending.length).toBe(2);
    });
  });
});
