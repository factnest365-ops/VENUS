/**
 * VENUS Phase 4 — Real Self-Improvement Engine
 *
 * The recursive core. Analyzes log.md, scores outcomes,
 * generates new rules from evidence, updates rules.md,
 * and tracks improvement metrics over time.
 *
 * This is not a toy evolve loop. This learns.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Paths ────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const CORE = dirname(__filename);
const METRICS_PATH = join(CORE, "metrics.json");

// ─── Types ────────────────────────────────────────────────────────────

export interface LogEntry {
  date: string;
  action: string;
  outcome: "success" | "failure" | "partial" | "unknown";
  pattern: string | null;
  raw: string;
}

export interface ScoredEntry extends LogEntry {
  score: number; // -1 to 1
  weight: number;
}

export interface Rule {
  id: string;
  title: string;
  body: string;
  source: "manual" | "learned";
  confidence: number;
  created: string;
  supersededBy?: string;
}

export interface EvolveMetrics {
  totalRuns: number;
  totalEntriesAnalyzed: number;
  rulesGenerated: number;
  rulesSuperseded: number;
  avgScorePerRun: number[];
  scoreTrend: "improving" | "declining" | "stable";
  lastRun: string;
  patternDetections: number;
  topPatterns: Array<{ pattern: string; count: number; avgScore: number }>;
}

export interface EvolveResult {
  entriesAnalyzed: number;
  avgScore: number;
  newRules: Rule[];
  supersededRules: string[];
  patternsDetected: string[];
  metrics: EvolveMetrics;
}

// ─── File I/O ─────────────────────────────────────────────────────────

function readFile(name: string): string {
  const path = join(CORE, name);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

function writeFile(name: string, content: string): void {
  writeFileSync(join(CORE, name), content, "utf-8");
}

function loadMetrics(): EvolveMetrics {
  if (!existsSync(METRICS_PATH)) {
    return defaultMetrics();
  }
  try {
    return JSON.parse(readFileSync(METRICS_PATH, "utf-8"));
  } catch {
    return defaultMetrics();
  }
}

function saveMetrics(m: EvolveMetrics): void {
  writeFileSync(METRICS_PATH, JSON.stringify(m, null, 2), "utf-8");
}

function defaultMetrics(): EvolveMetrics {
  return {
    totalRuns: 0,
    totalEntriesAnalyzed: 0,
    rulesGenerated: 0,
    rulesSuperseded: 0,
    avgScorePerRun: [],
    scoreTrend: "stable",
    lastRun: "",
    patternDetections: 0,
    topPatterns: [],
  };
}

// ─── Log Parsing ──────────────────────────────────────────────────────

/**
 * Parse log.md into structured entries.
 * Format expected:
 *   ## [Date]
 *   - **Action:** ...
 *   - **Outcome:** ...
 *   - **Pattern:** [if any]
 */
export function parseLogEntries(logContent: string): LogEntry[] {
  const entries: LogEntry[] = [];
  // Split on ## headings, then filter to only date-like entries
  const rawSections = logContent.split(/^## /m).filter((s) => s.trim());
  const sections = rawSections.filter((s) => {
    const heading = s.split("\n")[0].trim();
    return /^\[\d{4}-\d{2}-\d{2}\]$/.test(heading);
  });

  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // First line is [YYYY-MM-DD]
    const dateLine = lines[0].replace(/[[\]]/g, "").trim();

    let action = "";
    let outcome: LogEntry["outcome"] = "unknown";
    let pattern: string | null = null;

    for (const line of lines.slice(1)) {
      const actionMatch = line.match(/\*\*Action:\*\*\s*(.+)/i);
      const outcomeMatch = line.match(/\*\*Outcome:\*\*\s*(.+)/i);
      const patternMatch = line.match(/\*\*Pattern:\*\*\s*(.+)/i);

      if (actionMatch) action = actionMatch[1].trim();
      if (outcomeMatch) {
        const raw = outcomeMatch[1].trim().toLowerCase();
        if (raw.includes("success")) outcome = "success";
        else if (raw.includes("fail") || raw.includes("error")) outcome = "failure";
        else if (raw.includes("partial")) outcome = "partial";
        else outcome = "unknown";
      }
      if (patternMatch) {
        const p = patternMatch[1].trim();
        pattern = p === "..." || p === "if any" ? null : p;
      }
    }

    entries.push({
      date: dateLine,
      action,
      outcome,
      pattern,
      raw: section,
    });
  }

  return entries;
}

// ─── Scoring ──────────────────────────────────────────────────────────

/**
 * Score a log entry: -1 (terrible) to 1 (great).
 * Weights recency exponentially.
 */
export function scoreEntry(
  entry: LogEntry,
  index: number,
  total: number
): ScoredEntry {
  let score = 0;

  // Outcome base score
  switch (entry.outcome) {
    case "success": score = 1.0; break;
    case "partial": score = 0.3; break;
    case "failure": score = -1.0; break;
    case "unknown": score = 0.0; break;
  }

  // Pattern bonus: having an identified pattern means learning happened
  // Apply before clamping so capped entries still reflect the bonus
  if (entry.pattern) score += 0.15;

  // Recency weight: more recent entries matter more (exponential decay)
  const recencyRatio = index / Math.max(total - 1, 1);
  const weight = 0.3 + 0.7 * Math.pow(recencyRatio, 0.5);

  // Clamp the final score to [-1, 1]
  return { ...entry, score: Math.max(-1, Math.min(1, score)), weight };
}

export function scoreAll(entries: LogEntry[]): ScoredEntry[] {
  return entries.map((e, i) => scoreEntry(e, i, entries.length));
}

export function weightedAverage(scored: ScoredEntry[]): number {
  if (scored.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of scored) {
    weightedSum += s.score * s.weight;
    totalWeight += s.weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ─── Pattern Detection ────────────────────────────────────────────────

/**
 * Detect recurring patterns from log entries.
 * A "pattern" is a recurring action-outcome combination.
 */
export function detectPatterns(
  scored: ScoredEntry[]
): Array<{ pattern: string; count: number; avgScore: number }> {
  const map = new Map<string, { count: number; totalScore: number }>();

  for (const s of scored) {
    // Normalize action into a pattern key
    const key = s.action
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (!key) continue;

    const existing = map.get(key) ?? { count: 0, totalScore: 0 };
    existing.count++;
    existing.totalScore += s.score;
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .map(([pattern, { count, totalScore }]) => ({
      pattern,
      count,
      avgScore: count > 0 ? totalScore / count : 0,
    }))
    .filter((p) => p.count >= 2) // Need at least 2 occurrences
    .sort((a, b) => b.count - a.count || b.avgScore - a.avgScore);
}

// ─── Rule Generation ──────────────────────────────────────────────────

/**
 * Extract existing rules from rules.md.
 */
export function parseExistingRules(rulesContent: string): Rule[] {
  const rules: Rule[] = [];
  const sections = rulesContent.split(/^## /m).filter((s) => s.trim());

  for (const section of sections) {
    const lines = section.split("\n").filter((l) => l.trim());
    if (lines.length === 0) continue;

    const titleLine = lines[0].trim();
    // Extract rule number and title
    const match = titleLine.match(/^(\d+)\.\s*(.+)/);
    if (!match) continue;

    const id = `r${match[1]}`;
    const title = match[2].trim();
    const body = lines.slice(1).join("\n").trim();

    rules.push({
      id,
      title,
      body,
      source: "manual",
      confidence: 1.0,
      created: "unknown",
    });
  }

  return rules;
}

/**
 * Generate new rules from patterns and scored entries.
 *
 * Rules emerge from evidence:
 * - High-frequency failures → rule to avoid that action
 * - High-frequency successes → rule to prefer that action
 * - Recurring patterns with high scores → codify as heuristic
 */
export function generateRules(
  patterns: Array<{ pattern: string; count: number; avgScore: number }>,
  scored: ScoredEntry[],
  existingRules: Rule[]
): Rule[] {
  const newRules: Rule[] = [];
  const existingTitles = new Set(existingRules.map((r) => r.title.toLowerCase()));
  const now = new Date().toISOString().split("T")[0];

  // Rule from consistent failures
  const failurePatterns = patterns.filter((p) => p.avgScore < -0.3 && p.count >= 2);
  for (const fp of failurePatterns) {
    const title = `Avoid: ${capitalize(fp.pattern)}`;
    if (existingTitles.has(title.toLowerCase())) continue;

    newRules.push({
      id: `learned-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body: `Action "${fp.pattern}" failed ${fp.count}x with avg score ${fp.avgScore.toFixed(2)}. Avoid unless circumstances differ materially.`,
      source: "learned",
      confidence: Math.min(0.9, fp.count * 0.15),
      created: now,
    });
  }

  // Rule from consistent successes
  const successPatterns = patterns.filter((p) => p.avgScore > 0.5 && p.count >= 3);
  for (const sp of successPatterns) {
    const title = `Prefer: ${capitalize(sp.pattern)}`;
    if (existingTitles.has(title.toLowerCase())) continue;

    newRules.push({
      id: `learned-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body: `Action "${sp.pattern}" succeeded ${sp.count}x with avg score ${sp.avgScore.toFixed(2)}. Prefer when applicable.`,
      source: "learned",
      confidence: Math.min(0.95, sp.count * 0.1),
      created: now,
    });
  }

  // Rule from pattern emergence (recurring + high score)
  // Skip if Prefer/Avoid already covers this pattern
  const preferAvoidTitles = new Set(newRules.map((r) => r.title.toLowerCase()));
  const strongPatterns = patterns.filter((p) => p.count >= 3 && p.avgScore > 0.3);
  for (const sp of strongPatterns) {
    const title = `Pattern: ${capitalize(sp.pattern)}`;
    if (existingTitles.has(title.toLowerCase())) continue;
    // Skip if Prefer or Avoid already covers this exact pattern
    const covered = [...preferAvoidTitles].some((t) => {
      const keywords = sp.pattern.toLowerCase().split(" ");
      return keywords.every((w) => t.includes(w));
    });
    if (covered) continue;

    newRules.push({
      id: `learned-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      body: `Recurring pattern "${sp.pattern}" (${sp.count} occurrences, ${sp.avgScore.toFixed(2)} avg). Codify as standard approach.`,
      source: "learned",
      confidence: Math.min(0.85, sp.count * 0.1),
      created: now,
    });
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return newRules.filter((r) => {
    const key = r.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Detect rules that should be superseded (contradicted by new evidence).
 */
export function detectSuperseded(
  patterns: Array<{ pattern: string; count: number; avgScore: number }>,
  existingRules: Rule[]
): string[] {
  const superseded: string[] = [];

  for (const rule of existingRules) {
    const ruleLower = rule.title.toLowerCase();

    // Check if a "Prefer" rule contradicts an existing "Avoid" or vice versa
    for (const p of patterns) {
      const pLower = p.pattern.toLowerCase();

      // Match by checking if the rule title contains the pattern keywords
      const ruleKeywords = ruleLower.replace(/^(avoid|prefer|pattern):\s*/, "");
      const patternWords = pLower.split(" ");
      const matches = patternWords.length > 0 && patternWords.every((w) => ruleKeywords.includes(w));

      // If existing rule says "avoid X" but evidence shows X succeeds consistently
      if (ruleLower.startsWith("avoid:") && matches && p.avgScore > 0.5 && p.count >= 3) {
        superseded.push(rule.id);
      }

      // If existing rule says "prefer X" but evidence shows X fails consistently
      if (ruleLower.startsWith("prefer:") && matches && p.avgScore < -0.3 && p.count >= 3) {
        superseded.push(rule.id);
      }
    }
  }

  return [...new Set(superseded)];
}

// ─── Rules.md Update ──────────────────────────────────────────────────

/**
 * Update rules.md with new learned rules and superseded removals.
 */
export function updateRulesMd(
  rulesContent: string,
  newRules: Rule[],
  supersededIds: string[]
): string {
  if (newRules.length === 0 && supersededIds.length === 0) return rulesContent;

  let updated = rulesContent;

  // Remove superseded rules (by their ID comment)
  for (const id of supersededIds) {
    // Remove rule sections that contain the superseded ID
    const regex = new RegExp(
      `## \\d+\\. .*\\n(?:-.*\\n)*\\n?<!-- id: ${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} -->\\n?`,
      "g"
    );
    updated = updated.replace(regex, "");
  }

  // Find the highest existing rule number
  const numMatch = updated.match(/^## (\d+)\./gm);
  let maxNum = 0;
  if (numMatch) {
    for (const m of numMatch) {
      const n = parseInt(m.match(/\d+/)?.[0] ?? "0");
      if (n > maxNum) maxNum = n;
    }
  }

  // Append new rules
  if (newRules.length > 0) {
    const separator = updated.endsWith("\n\n") ? "" : "\n";
    const learnedHeader = "\n## Learned Rules\n> Auto-generated from log analysis. Confidence > 0.5 before inclusion.\n\n";
    const needsHeader = !updated.includes("## Learned Rules");

    let append = "";
    if (needsHeader) append += learnedHeader;

    for (let i = 0; i < newRules.length; i++) {
      maxNum++;
      const r = newRules[i];
      append += `## ${maxNum}. ${r.title}\n`;
      append += `${r.body}\n`;
      append += `*Confidence: ${(r.confidence * 100).toFixed(0)}% | Source: ${r.source} | ${r.created}*\n`;
      append += `<!-- id: ${r.id} -->\n\n`;
    }

    updated += separator + append;
  }

  // Update timestamp
  const dateStr = new Date().toISOString().split("T")[0];
  updated = updated.replace(
    /\*Last updated:.*\*/,
    `*Last updated: ${dateStr}*`
  );

  return updated;
}

// ─── Metrics ──────────────────────────────────────────────────────────

function updateMetrics(
  prev: EvolveMetrics,
  scored: ScoredEntry[],
  patterns: Array<{ pattern: string; count: number; avgScore: number }>,
  newRules: Rule[],
  supersededIds: string[]
): EvolveMetrics {
  const avgScore = weightedAverage(scored);
  const scoreHistory = [...prev.avgScorePerRun, avgScore];

  // Trend from last 5 runs
  const recent = scoreHistory.slice(-5);
  let trend: EvolveMetrics["scoreTrend"] = "stable";
  if (recent.length >= 2) {
    const first = recent[0];
    const last = recent[recent.length - 1];
    if (last - first > 0.1) trend = "improving";
    else if (first - last > 0.1) trend = "declining";
  }

  // Merge top patterns
  const mergedPatterns = new Map<string, { count: number; totalScore: number }>();
  for (const tp of prev.topPatterns) {
    mergedPatterns.set(tp.pattern, { count: tp.count, totalScore: tp.count * tp.avgScore });
  }
  for (const p of patterns) {
    const existing = mergedPatterns.get(p.pattern) ?? { count: 0, totalScore: 0 };
    existing.count = Math.max(existing.count, p.count);
    existing.totalScore = existing.count * p.avgScore;
    mergedPatterns.set(p.pattern, existing);
  }

  const topPatterns = Array.from(mergedPatterns.entries())
    .map(([pattern, { count, totalScore }]) => ({
      pattern,
      count,
      avgScore: count > 0 ? totalScore / count : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRuns: prev.totalRuns + 1,
    totalEntriesAnalyzed: prev.totalEntriesAnalyzed + scored.length,
    rulesGenerated: prev.rulesGenerated + newRules.length,
    rulesSuperseded: prev.rulesSuperseded + supersededIds.length,
    avgScorePerRun: scoreHistory.slice(-20), // Keep last 20
    scoreTrend: trend,
    lastRun: new Date().toISOString(),
    patternDetections: prev.patternDetections + patterns.length,
    topPatterns,
  };
}

// ─── Main Engine ──────────────────────────────────────────────────────

/**
 * Run one evolution cycle.
 *
 * 1. Parse log.md → structured entries
 * 2. Score each entry
 * 3. Detect patterns
 * 4. Generate new rules
 * 5. Detect superseded rules
 * 6. Update rules.md
 * 7. Update metrics.json
 */
export function realEvolve(): EvolveResult {
  const logContent = readFile("log.md");
  const rulesContent = readFile("rules.md");
  const metrics = loadMetrics();

  // 1. Parse
  const entries = parseLogEntries(logContent);

  // 2. Score
  const scored = scoreAll(entries);

  // 3. Patterns
  const patterns = detectPatterns(scored);

  // 4. Existing rules
  const existingRules = parseExistingRules(rulesContent);

  // 5. Generate new rules
  const newRules = generateRules(patterns, scored, existingRules);

  // 6. Detect superseded
  const supersededIds = detectSuperseded(patterns, existingRules);

  // 7. Update rules.md
  if (newRules.length > 0 || supersededIds.length > 0) {
    const updated = updateRulesMd(rulesContent, newRules, supersededIds);
    writeFile("rules.md", updated);
  }

  // 8. Update metrics
  const updatedMetrics = updateMetrics(metrics, scored, patterns, newRules, supersededIds);
  saveMetrics(updatedMetrics);

  return {
    entriesAnalyzed: entries.length,
    avgScore: weightedAverage(scored),
    newRules,
    supersededRules: supersededIds,
    patternsDetected: patterns.map((p) => p.pattern),
    metrics: updatedMetrics,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── CLI ──────────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].includes("real-evolve")) {
  console.log("🧠 VENUS Phase 4 — Real Self-Improvement Engine\n");

  const result = realEvolve();

  console.log(`Entries analyzed: ${result.entriesAnalyzed}`);
  console.log(`Average score: ${result.avgScore.toFixed(3)}`);
  console.log(`New rules generated: ${result.newRules.length}`);
  console.log(`Rules superseded: ${result.supersededRules.length}`);
  console.log(`Patterns detected: ${result.patternsDetected.length}`);
  console.log(`Score trend: ${result.metrics.scoreTrend}`);
  console.log(`Total runs: ${result.metrics.totalRuns}`);

  if (result.newRules.length > 0) {
    console.log("\n📜 New rules:");
    for (const r of result.newRules) {
      console.log(`  - ${r.title} (confidence: ${(r.confidence * 100).toFixed(0)}%)`);
    }
  }

  if (result.supersededRules.length > 0) {
    console.log(`\n🗑️  Superseded rules: ${result.supersededRules.join(", ")}`);
  }
}
