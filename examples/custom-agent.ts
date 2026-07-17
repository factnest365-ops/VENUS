/**
 * custom-agent.ts — Define and register a custom agent in VENUS
 */
import { spawnAgent, completeSpawn, recordResult, getLeaderboard } from '../agents/spawn';
import { initDB, logEvent } from '../memory/recall';

/**
 * Custom agent definition.
 * In production, add this to agents/registry.json.
 */
const customAgent = {
  name: 'debugger',
  type: 'worker',
  success_rate: 0.75,
  tasks_completed: 0,
  description: 'Diagnoses bugs by tracing code paths and analyzing stack traces',
};

/**
 * Simulate the full agent lifecycle:
 *   spawn → run → record → leaderboard
 */
async function runCustomAgent() {
  await initDB();

  // 1. Spawn the agent for a task
  const agentName = spawnAgent('trace null pointer in auth module');
  console.log(`🚀 Spawned agent: ${agentName}`);

  // 2. Log the task
  logEvent('agent_spawned', {
    agent: customAgent.name,
    task: 'trace null pointer in auth module',
  });

  // 3. Simulate work (replace with real execution)
  console.log('⚙️  Running task...');
  const success = Math.random() > 0.2; // 80% success rate
  await new Promise(r => setTimeout(r, 500));

  // 4. Record the result
  recordResult(customAgent.name, success);
  console.log(`✅ Task ${success ? 'succeeded' : 'failed'}`);

  // 5. Log the outcome
  logEvent('agent_completed', {
    agent: customAgent.name,
    success,
  });

  // 6. Show updated leaderboard
  const board = getLeaderboard();
  console.log('\n📊 Updated Leaderboard:');
  board.forEach(a =>
    console.log(`   ${a.name}: ${(a.success_rate * 100).toFixed(0)}% (${a.tasks_completed} tasks)`)
  );
}

runCustomAgent().catch(console.error);
