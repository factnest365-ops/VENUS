import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDB, logEvent, searchEvents, getPatterns, addPattern } from '../memory/recall';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DB = join(__dirname, 'test.db');

beforeAll(async () => {
  await initDB(TEST_DB);
});

afterAll(() => {
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }
});

describe('memory system', () => {
  it('logs events', () => {
    logEvent('test', 'hello world', 'success');
    const results = searchEvents('hello');
    expect(results.length).toBeGreaterThan(0);
  });

  it('searches events', () => {
    logEvent('test', 'searchable content', 'success');
    const results = searchEvents('searchable');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('searchable');
  });

  it('adds patterns', () => {
    addPattern('test-pattern', 0.8);
    const patterns = getPatterns(0);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('updates existing patterns', () => {
    addPattern('update-pattern', 0.5);
    addPattern('update-pattern', 0.9);
    const patterns = getPatterns(0.5);
    const found = patterns.find(p => p.pattern === 'update-pattern');
    expect(found).toBeDefined();
    expect(found!.frequency).toBeGreaterThan(1);
  });
});
