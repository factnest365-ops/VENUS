#!/usr/bin/env tsx
/**
 * VENUS — Self-Improving AI Agent System
 * 
 * Mid model + perfect structure = AGI-level performance
 * 
 * Usage:
 *   npx tsx index.ts          — Run evolution loop
 *   npx tsx index.ts greet    — Get a greeting
 *   npx tsx index.ts status   — Show system status
 *   npx tsx index.ts joke     — Hear a joke
 */

// Core
export { evolve } from './core/evolve';
export { main } from './core/index';

// Memory
export { initDB, logEvent, searchEvents, getPatterns, addPattern, getStats } from './memory/recall';

// Agents
export { pickBestAgent, spawnAgent, completeSpawn } from './agents/spawn';
export { recordResult, getLeaderboard } from './agents/evaluate';
export { runAgent, suggestAgent } from './agents/index';

// Personality
export { getVoice, shouldJoke, getVoicePrefix } from './personality/voice';
export { respond, greet, farewell, getJoke } from './personality/index';
export {
  createPersonality,
  loadPersonality,
  savePersonality,
  recordInteraction,
  getContinuityVoice,
  setPreference,
  getPreference,
  transitionMood,
  setMood,
} from './personality/continuity';

// Pi Tasks
export {
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
} from './pi/tasks';

// CLI
const command = process.argv[2];

async function cli() {
  switch (command) {
    case 'greet':
      const { greet: g } = await import('./personality/index');
      console.log(g());
      break;

    case 'status':
      const { initDB: init, getStats } = await import('./memory/recall');
      await init();
      const stats = getStats();
      console.log('🧠 VENUS Status');
      console.log(`  Events: ${stats.events}`);
      console.log(`  Patterns: ${stats.patterns}`);
      console.log(`  Rules: ${stats.rules}`);
      const { getLeaderboard: lb } = await import('./agents/evaluate');
      const board = lb();
      console.log('  Agents:');
      board.forEach(a => console.log(`    ${a.name}: ${(a.success_rate * 100).toFixed(0)}% (${a.tasks_completed} tasks)`));
      break;

    case 'joke':
      const { getJoke: j } = await import('./personality/index');
      console.log(j() ?? 'No jokes available.');
      break;

    default:
      const { main: run } = await import('./core/index');
      await run();
  }
}

cli().catch(console.error);
