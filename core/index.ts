import { evolve } from './evolve';
import { initDB, logEvent } from '../memory/recall';
import { getVoice } from '../personality/voice';

export async function main(): Promise<void> {
  console.log('🧠 VENUS — Self-Improving Agent System\n');

  // Init memory
  await initDB();
  console.log('✓ Memory initialized');

  // Run evolution loop
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`\n--- Iteration ${iterations} ---`);

    // 1. Evolve — decide what to do
    const action = evolve();
    console.log(`Action: ${action.type} — ${action.reason}`);

    if (action.type === 'stop') {
      console.log('✓ Evolution complete.');
      break;
    }

    // 2. Execute action
    const startTime = Date.now();
    let success = false;

    try {
      switch (action.type) {
        case 'create':
          console.log(`  Creating: ${action.target}`);
          success = true;
          break;
        case 'edit':
          console.log(`  Editing: ${action.target}`);
          success = true;
          break;
        case 'delete':
          console.log(`  Deleting: ${action.target}`);
          success = true;
          break;
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err}`);
      success = false;
    }

    const duration = Date.now() - startTime;

    // 3. Log result
    logEvent('evolution', `${action.type}: ${action.target ?? 'none'}`, success ? 'success' : 'failure');

    // 4. Voice context
    const voice = getVoice({ event: success ? 'success' : 'error' });
    console.log(`  Voice: ${voice.tone} | ${success ? '✓' : '✗'} (${duration}ms)`);
  }

  console.log('\n🧠 VENUS session complete.');
}

// CLI entry
if (process.argv[1] && process.argv[1].includes('core')) {
  main().catch(console.error);
}
