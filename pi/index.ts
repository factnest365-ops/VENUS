/**
 * Pi Integration Layer
 *
 * Bridges Pi agent into the VENUS system — loads rules + patterns,
 * initialises memory DB, and exposes a typed context object
 * any Pi task can consume.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDB, getPatterns, getStats } from '../memory/recall';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// ── Types ────────────────────────────────────────────────────────────

export interface RuleSection {
  heading: string;
  body: string;
}

export interface PatternEntry {
  name: string;
  trigger: string;
  action: string;
  successRate: number;
}

export interface VENUSContext {
  rules: RuleSection[];
  patterns: PatternEntry[];
  memoryStats: { events: number; patterns: number; rules: number };
  ready: boolean;
}

// ── Internal state ───────────────────────────────────────────────────

let context: VENUSContext = {
  rules: [],
  patterns: [],
  memoryStats: { events: 0, patterns: 0, rules: 0 },
  ready: false,
};

// ── Markdown parsers ─────────────────────────────────────────────────

/**
 * Parse markdown into sections split by ## headings.
 * Returns array of { heading, body } for each section.
 */
export function parseMarkdownSections(md: string): RuleSection[] {
  const sections: RuleSection[] = [];
  const lines = md.split('\n');
  let current: RuleSection | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { heading: headingMatch[1].trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);

  return sections;
}

/**
 * Parse patterns.md into structured PatternEntry[].
 * Each "## Pattern:" block becomes one entry.
 */
export function parsePatterns(md: string): PatternEntry[] {
  const entries: PatternEntry[] = [];
  const blocks = md.split(/^## Pattern:\s*/m).slice(1);

  for (const block of blocks) {
    const nameMatch = block.match(/^(.+)/);
    const triggerMatch = block.match(/\*\*Trigger:\*\*\s*(.+)/);
    const actionMatch = block.match(/\*\*Action:\*\*\s*(.+)/);
    const rateMatch = block.match(/\*\*Success Rate:\*\*\s*(\d+)/);

    entries.push({
      name: nameMatch?.[1]?.trim() ?? 'unknown',
      trigger: triggerMatch?.[1]?.trim() ?? '',
      action: actionMatch?.[1]?.trim() ?? '',
      successRate: rateMatch ? Number(rateMatch[1]) : 0,
    });
  }

  return entries;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Initialise the VENUS system for Pi.
 * Call once at the start of a Pi session.
 */
export async function initVENUS(dbPath?: string): Promise<void> {
  // 1. Load rules
  const rulesRaw = readFileSync(join(PROJECT_ROOT, 'rules.md'), 'utf-8');
  const rules = parseMarkdownSections(rulesRaw);

  // 2. Load patterns (file)
  const patternsRaw = readFileSync(join(PROJECT_ROOT, 'patterns.md'), 'utf-8');
  const patterns = parsePatterns(patternsRaw);

  // 3. Init memory DB
  await initDB(dbPath);

  // 4. Build context
  context = {
    rules,
    patterns,
    memoryStats: getStats(),
    ready: true,
  };
}

/**
 * Return the current VENUS context.
 * Safe to call any time after initVENUS().
 */
export function getContext(): VENUSContext {
  return { ...context };
}
