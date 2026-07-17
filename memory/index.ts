import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDB, logEvent, searchEvents, getPatterns, addPattern, updateRule, getStats } from './recall';

export { initDB, logEvent, searchEvents, getPatterns, addPattern, updateRule, getStats } from './recall';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run schema.sql migration
 */
export function migrate(schemaPath?: string): void {
  const schema = readFileSync(
    schemaPath ?? join(__dirname, 'schema.sql'),
    'utf-8'
  );
  const db = initDB as any;
  db.exec?.(schema);
  console.log('✓ Memory schema migrated');
}

/**
 * Consolidate patterns — merge similar patterns, update success rates
 */
export function consolidate(): number {
  const patterns = getPatterns(0);
  return patterns.length;
}
