import Database from 'better-sqlite3';

let db: Database.Database;

export function initDB(path = './venus.db'): Database.Database {
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      outcome TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL UNIQUE,
      success_rate REAL DEFAULT 0,
      occurrences INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}

export function logEvent(type: string, content: string, outcome?: string): number {
  const stmt = db.prepare(
    'INSERT INTO events (type, content, outcome) VALUES (?, ?, ?)'
  );
  const result = stmt.run(type, content, outcome ?? null);
  return Number(result.lastInsertRowid);
}

export function searchEvents(query: string, limit = 20): Array<{
  id: number;
  type: string;
  content: string;
  outcome: string | null;
  created_at: string;
}> {
  const stmt = db.prepare(
    `SELECT id, type, content, outcome, created_at
     FROM events
     WHERE content LIKE ? OR type LIKE ? OR outcome LIKE ?
     ORDER BY created_at DESC
     LIMIT ?`
  );
  const pattern = `%${query}%`;
  return stmt.all(pattern, pattern, pattern, limit) as any[];
}

export function getPatterns(minRate = 0.5): Array<{
  id: number;
  pattern: string;
  success_rate: number;
  occurrences: number;
}> {
  const stmt = db.prepare(
    `SELECT id, pattern, success_rate, occurrences
     FROM patterns
     WHERE success_rate >= ?
     ORDER BY success_rate DESC, occurrences DESC`
  );
  return stmt.all(minRate) as any[];
}

export function addPattern(pattern: string, successRate = 0): number {
  const stmt = db.prepare(
    `INSERT INTO patterns (pattern, success_rate)
     VALUES (?, ?)
     ON CONFLICT(pattern) DO UPDATE SET
       success_rate = (success_rate * occurrences + excluded.success_rate) / (occurrences + 1),
       occurrences = occurrences + 1,
       updated_at = datetime('now')`
  );
  const result = stmt.run(pattern, successRate);
  return Number(result.lastInsertRowid);
}

export function updateRule(id: number, rule: string): boolean {
  const stmt = db.prepare(
    `UPDATE rules SET rule = ?, updated_at = datetime('now')
     WHERE id = ?`
  );
  const result = stmt.run(rule, id);
  return result.changes > 0;
}
