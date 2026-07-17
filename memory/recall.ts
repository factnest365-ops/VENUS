import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database;
const DB_PATH = join(__dirname, 'venus.db');

export async function initDB(path?: string): Promise<Database> {
  const SQL = await initSqlJs();
  const dbPath = path ?? DB_PATH;
  
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      outcome TEXT
    );
    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL UNIQUE,
      frequency INTEGER DEFAULT 1,
      success_rate REAL DEFAULT 0.0
    );
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule TEXT NOT NULL,
      created TEXT DEFAULT (datetime('now')),
      last_updated TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}

function saveDB(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

export function logEvent(type: string, content: string, outcome?: string): number {
  db.run(
    'INSERT INTO events (type, content, outcome) VALUES (?, ?, ?)',
    [type, content, outcome ?? null]
  );
  saveDB();
  
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0]?.[0] as number ?? 0;
}

export function searchEvents(query: string, limit = 20): Array<{
  id: number;
  type: string;
  content: string;
  outcome: string | null;
  timestamp: string;
}> {
  const stmt = db.prepare(
    `SELECT id, type, content, outcome, timestamp
     FROM events
     WHERE content LIKE ? OR type LIKE ? OR outcome LIKE ?
     ORDER BY timestamp DESC
     LIMIT ?`
  );
  stmt.bind([`%${query}%`, `%${query}%`, `%${query}%`, limit]);
  
  const results: Array<{
    id: number;
    type: string;
    content: string;
    outcome: string | null;
    timestamp: string;
  }> = [];
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row as any);
  }
  stmt.free();
  
  return results;
}

export function getPatterns(minRate = 0.5): Array<{
  id: number;
  pattern: string;
  success_rate: number;
  frequency: number;
}> {
  const stmt = db.prepare(
    `SELECT id, pattern, success_rate, frequency
     FROM patterns
     WHERE success_rate >= ?
     ORDER BY success_rate DESC, frequency DESC`
  );
  stmt.bind([minRate]);
  
  const results: Array<{
    id: number;
    pattern: string;
    success_rate: number;
    frequency: number;
  }> = [];
  
  while (stmt.step()) {
    results.push(stmt.getAsObject() as any);
  }
  stmt.free();
  
  return results;
}

export function addPattern(pattern: string, successRate = 0): number {
  // Check if pattern exists
  const existing = db.exec(
    'SELECT id, success_rate, frequency FROM patterns WHERE pattern = ?',
    [pattern]
  );
  
  if (existing.length > 0 && existing[0].values.length > 0) {
    const [id, oldRate, freq] = existing[0].values[0] as [number, number, number];
    const newRate = (oldRate * freq + successRate) / (freq + 1);
    db.run(
      'UPDATE patterns SET success_rate = ?, frequency = frequency + 1 WHERE id = ?',
      [newRate, id]
    );
    saveDB();
    return id;
  } else {
    db.run(
      'INSERT INTO patterns (pattern, success_rate) VALUES (?, ?)',
      [pattern, successRate]
    );
    saveDB();
    
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0]?.values[0]?.[0] as number ?? 0;
  }
}

export function updateRule(id: number, rule: string): boolean {
  db.run(
    'UPDATE rules SET rule = ?, last_updated = datetime(\'now\') WHERE id = ?',
    [rule, id]
  );
  saveDB();
  return true;
}

export function getStats(): { events: number; patterns: number; rules: number } {
  const events = db.exec('SELECT COUNT(*) as count FROM events');
  const patterns = db.exec('SELECT COUNT(*) as count FROM patterns');
  const rules = db.exec('SELECT COUNT(*) as count FROM rules');
  
  return {
    events: events[0]?.values[0]?.[0] as number ?? 0,
    patterns: patterns[0]?.values[0]?.[0] as number ?? 0,
    rules: rules[0]?.values[0]?.[0] as number ?? 0,
  };
}
