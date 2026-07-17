/**
 * basic-usage.ts — Run VENUS, query memory, check agents
 */
import { evolve } from '../core/evolve';
import { initDB, logEvent, searchEvents, getStats } from '../memory/recall';
import { getLeaderboard } from '../agents/evaluate';
import { greet, getJoke } from '../personality/index';

async function main() {
  // 1. Greeting
  console.log(greet());
  console.log();

  // 2. Initialize memory
  await initDB();

  // 3. Log an event
  logEvent('session_started', { ts: Date.now() });
  console.log('✅ Event logged');

  // 4. Search events
  const events = searchEvents('session');
  console.log(`🔍 Found ${events.length} matching event(s)`);

  // 5. Run one evolution step
  const action = evolve();
  console.log(`\n🧬 Evolution action: ${action.type}`);
  if (action.target) console.log(`   Target: ${action.target}`);
  console.log(`   Reason: ${action.reason}`);

  // 6. Agent leaderboard
  const board = getLeaderboard();
  console.log('\n📊 Agent Leaderboard:');
  board.forEach(a =>
    console.log(`   ${a.name}: ${(a.success_rate * 100).toFixed(0)}% (${a.tasks_completed} tasks)`)
  );

  // 7. System stats
  const stats = getStats();
  console.log(`\n🧠 Stats: ${stats.events} events, ${stats.patterns} patterns`);

  // 8. Joke to close
  console.log(`\n😄 ${getJoke() ?? 'No jokes yet.'}`);
}

main().catch(console.error);
