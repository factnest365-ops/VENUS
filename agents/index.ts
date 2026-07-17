import { pickBestAgent, spawnAgent, completeSpawn, type ActiveAgent } from './spawn';
import { recordResult, getLeaderboard, type TaskResult } from './evaluate';

export { pickBestAgent, spawnAgent, completeSpawn } from './spawn';
export { recordResult, getLeaderboard } from './evaluate';

/**
 * Run an agent on a task — full lifecycle
 */
export async function runAgent(
  task: string,
  executor: (agent: string, task: string) => Promise<boolean>
): Promise<{ agent: string; succeeded: boolean; duration_ms: number }> {
  // 1. Pick best agent
  const agent = pickBestAgent(task);
  if (!agent) {
    console.log('No available agent for task');
    return { agent: 'none', succeeded: false, duration_ms: 0 };
  }

  // 2. Spawn
  const taskId = `task-${Date.now()}`;
  const spawned = spawnAgent(agent.name, taskId);
  if (!spawned) {
    console.log(`Failed to spawn ${agent.name}`);
    return { agent: agent.name, succeeded: false, duration_ms: 0 };
  }

  console.log(`✓ Spawned ${agent.name} for: ${task}`);

  // 3. Execute
  const start = Date.now();
  let succeeded = false;

  try {
    succeeded = await executor(agent.name, task);
  } catch (err) {
    console.error(`✗ ${agent.name} failed: ${err}`);
    succeeded = false;
  }

  const duration = Date.now() - start;

  // 4. Record result
  recordResult({
    agent: agent.name,
    task_id: taskId,
    succeeded,
    duration_ms: duration,
  });

  // 5. Complete
  completeSpawn(taskId);

  console.log(`${succeeded ? '✓' : '✗'} ${agent.name} finished (${duration}ms)`);

  return { agent: agent.name, succeeded, duration_ms: duration };
}

/**
 * Get best agent for a task without spawning
 */
export function suggestAgent(task: string): string | null {
  const agent = pickBestAgent(task);
  return agent?.name ?? null;
}
