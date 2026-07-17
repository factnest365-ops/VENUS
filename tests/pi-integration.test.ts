import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  initVENUS,
  getContext,
  parseMarkdownSections,
  parsePatterns,
  type RuleSection,
  type PatternEntry,
  type VENUSContext,
} from '../pi/index';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DB = join(__dirname, 'test-pi.db');

beforeAll(async () => {
  // Init DB to a temp path so tests don't touch production data
  await initVENUS(TEST_DB);
});

afterAll(() => {
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }
});

// ── Markdown parsers ─────────────────────────────────────────────────

describe('parseMarkdownSections', () => {
  it('splits markdown by ## headings', () => {
    const md = `# Title

Intro text.

## Section One
Body one.

## Section Two
Body two.`;

    const sections = parseMarkdownSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe('Section One');
    expect(sections[0].body).toContain('Body one.');
    expect(sections[1].heading).toBe('Section Two');
  });

  it('returns empty array for no sections', () => {
    expect(parseMarkdownSections('# Just a title\nNo sections here.')).toHaveLength(0);
  });
});

describe('parsePatterns', () => {
  it('extracts pattern entries', () => {
    const md = `# Patterns

## Pattern: retry-on-failure
- **Trigger:** task fails
- **Action:** retry with different agent
- **Success Rate:** 85%

## Pattern: skip-trivial
- **Trigger:** trivially simple task
- **Action:** execute directly
- **Success Rate:** 100%`;

    const entries = parsePatterns(md);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('retry-on-failure');
    expect(entries[0].trigger).toBe('task fails');
    expect(entries[0].successRate).toBe(85);
    expect(entries[1].name).toBe('skip-trivial');
    expect(entries[1].successRate).toBe(100);
  });
});

// ── initVENUS ────────────────────────────────────────────────────────

describe('initVENUS', () => {
  it('loads rules from rules.md', () => {
    const ctx = getContext();
    expect(ctx.ready).toBe(true);
    expect(ctx.rules.length).toBeGreaterThan(0);
    // Should have the "Check Before Acting" rule
    const headings = ctx.rules.map((r: RuleSection) => r.heading);
    expect(headings).toContain('1. Check Before Acting');
  });

  it('loads patterns from patterns.md', () => {
    const ctx = getContext();
    expect(ctx.patterns).toBeDefined();
    expect(Array.isArray(ctx.patterns)).toBe(true);
  });

  it('sets ready to true', () => {
    expect(getContext().ready).toBe(true);
  });
});

// ── getContext ───────────────────────────────────────────────────────

describe('getContext', () => {
  it('returns VENUSContext with expected shape', () => {
    const ctx = getContext();
    expect(ctx).toHaveProperty('rules');
    expect(ctx).toHaveProperty('patterns');
    expect(ctx).toHaveProperty('memoryStats');
    expect(ctx).toHaveProperty('ready');

    // memoryStats shape
    expect(typeof ctx.memoryStats.events).toBe('number');
    expect(typeof ctx.memoryStats.patterns).toBe('number');
    expect(typeof ctx.memoryStats.rules).toBe('number');
  });

  it('returns a copy, not the internal reference', () => {
    const a = getContext();
    const b = getContext();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ── Memory initialization ───────────────────────────────────────────

describe('memory initialization', () => {
  it('reports stats after init', () => {
    const ctx = getContext();
    expect(ctx.memoryStats.events).toBeGreaterThanOrEqual(0);
  });

  it('getContext returns zeroed stats on fresh DB', () => {
    // Our test DB is fresh — stats should reflect empty tables
    const ctx = getContext();
    expect(ctx.memoryStats.events).toBe(0);
    expect(ctx.memoryStats.patterns).toBe(0);
  });
});
