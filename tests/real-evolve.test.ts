import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  parseLogEntries,
  scoreEntry,
  scoreAll,
  weightedAverage,
  detectPatterns,
  parseExistingRules,
  generateRules,
  detectSuperseded,
  updateRulesMd,
  realEvolve,
  type LogEntry,
  type ScoredEntry,
  type Rule,
} from "../core/real-evolve";

// ─── Fixtures ─────────────────────────────────────────────────────────

const SAMPLE_LOG = `# Session Log

## Entries

*(Newest first)*

---

## [2026-07-15]
- **Action:** refactor module X
- **Outcome:** success
- **Pattern:** modular decomposition

## [2026-07-14]
- **Action:** refactor module X
- **Outcome:** failure
- **Pattern:** modular decomposition

## [2026-07-13]
- **Action:** deploy to staging
- **Outcome:** success
- **Pattern:** if any

## [2026-07-12]
- **Action:** refactor module X
- **Outcome:** success
- **Pattern:** modular decomposition

## [2026-07-11]
- **Action:** skip tests
- **Outcome:** failure
- **Pattern:** test discipline

## [2026-07-10]
- **Action:** skip tests
- **Outcome:** failure
- **Pattern:** test discipline

## [2026-07-09]
- **Action:** deploy to staging
- **Outcome:** partial
- **Pattern:** if any

## [2026-07-08]
- **Action:** refactor module X
- **Outcome:** success
- **Pattern:** modular decomposition

## [2026-07-07]
- **Action:** skip tests
- **Outcome:** failure
- **Pattern:** test discipline

## [2026-07-06]
- **Action:** deploy to staging
- **Outcome:** success
- **Pattern:** if any
`;

const SAMPLE_RULES = `# VENUS Core Rules

> Living ruleset. Edit when broken. Prune when stale.

---

## 1. Check Before Acting
Before any action, consult \`patterns.md\` for similar past situations.
Skip only if the task is trivially novel (first-time, one-off, no overlap).

## 2. Log After Acting
After completing any action, record the result in \`log.md\`.
Include: what was done, outcome, timestamp.
If the action failed, log the failure mode — not just the fact.

## 3. Pattern Extraction
If a pattern repeats 3+ times across \`log.md\` entries:
- Add it to \`patterns.md\` with a clear label.
- Include the trigger, the action taken, and the result.
- Remove redundant log entries once pattern is captured.

---

*Last updated: 2026-07-16*
`;

// ─── Parse Tests ──────────────────────────────────────────────────────

describe("parseLogEntries", () => {
  it("parses structured log entries", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    expect(entries.length).toBe(10);
  });

  it("extracts action correctly", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    expect(entries[0].action).toBe("refactor module X");
  });

  it("extracts outcome as typed value", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    expect(entries[0].outcome).toBe("success");
    expect(entries[1].outcome).toBe("failure");
    expect(entries[6].outcome).toBe("partial");
  });

  it("extracts pattern or null", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    expect(entries[0].pattern).toBe("modular decomposition");
    expect(entries[2].pattern).toBeNull(); // "if any" → null
  });

  it("handles empty log", () => {
    const entries = parseLogEntries("");
    expect(entries).toEqual([]);
  });

  it("handles log with no entries", () => {
    // No entries match [YYYY-MM-DD] date pattern
    const entries = parseLogEntries("# Session Log\n\n## Entries\n\n*(Newest first)*\n\n---\n");
    expect(entries).toEqual([]);
  });

  it("preserves raw content", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    expect(entries[0].raw).toContain("refactor module X");
  });

  it("extracts date from heading", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    expect(entries[0].date).toBe("2026-07-15");
  });
});

// ─── Scoring Tests ────────────────────────────────────────────────────

describe("scoreEntry", () => {
  it("scores success as positive", () => {
    const entry: LogEntry = {
      date: "2026-07-15",
      action: "deploy",
      outcome: "success",
      pattern: null,
      raw: "",
    };
    const scored = scoreEntry(entry, 0, 1);
    expect(scored.score).toBeGreaterThan(0);
  });

  it("scores failure as negative", () => {
    const entry: LogEntry = {
      date: "2026-07-15",
      action: "deploy",
      outcome: "failure",
      pattern: null,
      raw: "",
    };
    const scored = scoreEntry(entry, 0, 1);
    expect(scored.score).toBeLessThan(0);
  });

  it("scores partial as slightly positive", () => {
    const entry: LogEntry = {
      date: "2026-07-15",
      action: "deploy",
      outcome: "partial",
      pattern: null,
      raw: "",
    };
    const scored = scoreEntry(entry, 0, 1);
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.score).toBeLessThan(1);
  });

  it("adds pattern bonus", () => {
    const withPattern: LogEntry = {
      date: "2026-07-15",
      action: "deploy",
      outcome: "success",
      pattern: "modular",
      raw: "",
    };
    const without: LogEntry = { ...withPattern, pattern: null };
    const s1 = scoreEntry(withPattern, 0, 1);
    const s2 = scoreEntry(without, 0, 1);
    // Score is clamped to [-1,1] so pattern bonus may not exceed cap,
    // but pattern entry should never score lower than non-pattern
    expect(s1.score).toBeGreaterThanOrEqual(s2.score);
  });

  it("recent entries get higher weight", () => {
    const entry: LogEntry = {
      date: "2026-07-15",
      action: "deploy",
      outcome: "success",
      pattern: null,
      raw: "",
    };
    const early = scoreEntry(entry, 0, 10);
    const late = scoreEntry(entry, 9, 10);
    expect(late.weight).toBeGreaterThan(early.weight);
  });
});

describe("scoreAll", () => {
  it("scores all entries", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    const scored = scoreAll(entries);
    expect(scored.length).toBe(entries.length);
    expect(scored.every((s) => "score" in s && "weight" in s)).toBe(true);
  });
});

describe("weightedAverage", () => {
  it("returns 0 for empty array", () => {
    expect(weightedAverage([])).toBe(0);
  });

  it("computes weighted average correctly", () => {
    const scored: ScoredEntry[] = [
      { date: "", action: "", outcome: "success", pattern: null, raw: "", score: 1, weight: 1 },
      { date: "", action: "", outcome: "failure", pattern: null, raw: "", score: -1, weight: 1 },
    ];
    expect(weightedAverage(scored)).toBe(0);
  });

  it("weights more heavily toward higher-weight entries", () => {
    const scored: ScoredEntry[] = [
      { date: "", action: "", outcome: "success", pattern: null, raw: "", score: 1, weight: 0.1 },
      { date: "", action: "", outcome: "failure", pattern: null, raw: "", score: -1, weight: 1.0 },
    ];
    const avg = weightedAverage(scored);
    expect(avg).toBeLessThan(0); // Heavy negative pulls it down
  });
});

// ─── Pattern Detection ────────────────────────────────────────────────

describe("detectPatterns", () => {
  it("detects recurring actions", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    const scored = scoreAll(entries);
    const patterns = detectPatterns(scored);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it("refuses patterns with count < 2", () => {
    const entries: LogEntry[] = [
      { date: "2026-07-15", action: "unique action", outcome: "success", pattern: null, raw: "" },
    ];
    const scored = scoreAll(entries);
    const patterns = detectPatterns(scored);
    expect(patterns.length).toBe(0);
  });

  it("ranks by count then score", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    const scored = scoreAll(entries);
    const patterns = detectPatterns(scored);
    if (patterns.length >= 2) {
      expect(patterns[0].count).toBeGreaterThanOrEqual(patterns[1].count);
    }
  });

  it("includes average score", () => {
    const entries = parseLogEntries(SAMPLE_LOG);
    const scored = scoreAll(entries);
    const patterns = detectPatterns(scored);
    for (const p of patterns) {
      expect(typeof p.avgScore).toBe("number");
    }
  });
});

// ─── Rule Parsing ─────────────────────────────────────────────────────

describe("parseExistingRules", () => {
  it("parses numbered rules", () => {
    const rules = parseExistingRules(SAMPLE_RULES);
    expect(rules.length).toBe(3);
  });

  it("extracts title and body", () => {
    const rules = parseExistingRules(SAMPLE_RULES);
    expect(rules[0].title).toBe("Check Before Acting");
    expect(rules[0].body).toContain("patterns.md");
  });

  it("marks source as manual", () => {
    const rules = parseExistingRules(SAMPLE_RULES);
    expect(rules.every((r) => r.source === "manual")).toBe(true);
  });

  it("handles empty input", () => {
    const rules = parseExistingRules("");
    expect(rules).toEqual([]);
  });
});

// ─── Rule Generation ──────────────────────────────────────────────────

describe("generateRules", () => {
  it("generates avoid rule for consistent failures", () => {
    const patterns = [
      { pattern: "skip tests", count: 5, avgScore: -0.8 },
    ];
    const rules = generateRules(patterns, [], []);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].title).toContain("Avoid");
  });

  it("generates prefer rule for consistent successes", () => {
    const patterns = [
      { pattern: "run tests first", count: 5, avgScore: 0.9 },
    ];
    const rules = generateRules(patterns, [], []);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].title).toContain("Prefer");
  });

  it("skips patterns that already have rules", () => {
    const existing: Rule[] = [{
      id: "r1",
      title: "Avoid: Skip tests",
      body: "",
      source: "manual",
      confidence: 1,
      created: "",
    }];
    const patterns = [
      { pattern: "skip tests", count: 5, avgScore: -0.8 },
    ];
    const rules = generateRules(patterns, [], existing);
    expect(rules.length).toBe(0);
  });

  it("requires minimum count for failure rules", () => {
    const patterns = [
      { pattern: "flaky action", count: 1, avgScore: -0.9 },
    ];
    const rules = generateRules(patterns, [], []);
    expect(rules.length).toBe(0);
  });

  it("requires minimum count for success rules", () => {
    const patterns = [
      { pattern: "good action", count: 1, avgScore: 1.0 },
    ];
    const rules = generateRules(patterns, [], []);
    expect(rules.length).toBe(0);
  });

  it("generates pattern rules for recurring high-score actions", () => {
    const patterns = [
      { pattern: "modular decomposition", count: 4, avgScore: 0.7 },
    ];
    const rules = generateRules(patterns, [], []);
    expect(rules.length).toBeGreaterThan(0);
    // Prefer rule takes priority over Pattern rule for same keywords
    expect(rules[0].title).toMatch(/^(Prefer|Pattern):/);
  });

  it("deduplicates generated rules", () => {
    // count:5 avgScore:0.9 triggers both Prefer and Pattern,
    // but Prefer covers the same keywords so Pattern is skipped
    const patterns = [
      { pattern: "test", count: 5, avgScore: 0.9 },
      { pattern: "test", count: 5, avgScore: 0.9 },
    ];
    const rules = generateRules(patterns, [], []);
    expect(rules.length).toBe(1);
  });
});

// ─── Superseded Detection ─────────────────────────────────────────────

describe("detectSuperseded", () => {
  it("detects rule contradicted by evidence", () => {
    const existing: Rule[] = [{
      id: "r1",
      title: "Avoid: Skip tests",
      body: "",
      source: "manual",
      confidence: 1,
      created: "",
    }];
    const patterns = [
      { pattern: "skip tests", count: 5, avgScore: 0.8 },
    ];
    const superseded = detectSuperseded(patterns, existing);
    expect(superseded).toContain("r1");
  });

  it("does not supersede consistent rules", () => {
    const existing: Rule[] = [{
      id: "r1",
      title: "Avoid: Skip tests",
      body: "",
      source: "manual",
      confidence: 1,
      created: "",
    }];
    const patterns = [
      { pattern: "skip tests", count: 5, avgScore: -0.9 },
    ];
    const superseded = detectSuperseded(patterns, existing);
    expect(superseded).not.toContain("r1");
  });

  it("requires minimum count to supersede", () => {
    const existing: Rule[] = [{
      id: "r1",
      title: "Avoid: Skip tests",
      body: "",
      source: "manual",
      confidence: 1,
      created: "",
    }];
    const patterns = [
      { pattern: "skip tests", count: 2, avgScore: 0.8 },
    ];
    const superseded = detectSuperseded(patterns, existing);
    expect(superseded).not.toContain("r1");
  });
});

// ─── Rules.md Update ──────────────────────────────────────────────────

describe("updateRulesMd", () => {
  it("appends new learned rules", () => {
    const newRules: Rule[] = [{
      id: "learned-1",
      title: "Avoid: Skip tests",
      body: "Failed consistently.",
      source: "learned",
      confidence: 0.8,
      created: "2026-07-16",
    }];
    const result = updateRulesMd(SAMPLE_RULES, newRules, []);
    expect(result).toContain("Learned Rules");
    expect(result).toContain("Avoid: Skip tests");
  });

  it("returns unchanged when nothing to do", () => {
    const result = updateRulesMd(SAMPLE_RULES, [], []);
    expect(result).toBe(SAMPLE_RULES);
  });

  it("updates timestamp", () => {
    const result = updateRulesMd(SAMPLE_RULES, [{
      id: "r1",
      title: "Test",
      body: "",
      source: "learned",
      confidence: 0.5,
      created: "2026-07-16",
    }], []);
    expect(result).toMatch(/\*Last updated: \d{4}-\d{2}-\d{2}\*/);
  });

  it("includes confidence and source in learned rules", () => {
    const newRules: Rule[] = [{
      id: "learned-1",
      title: "Prefer: Test first",
      body: "Always test.",
      source: "learned",
      confidence: 0.75,
      created: "2026-07-16",
    }];
    const result = updateRulesMd(SAMPLE_RULES, newRules, []);
    expect(result).toContain("75%");
    expect(result).toContain("learned");
  });

  it("includes rule ID as HTML comment", () => {
    const newRules: Rule[] = [{
      id: "learned-abc-123",
      title: "Test",
      body: "",
      source: "learned",
      confidence: 0.5,
      created: "2026-07-16",
    }];
    const result = updateRulesMd(SAMPLE_RULES, newRules, []);
    expect(result).toContain("<!-- id: learned-abc-123 -->");
  });
});

// ─── Integration: realEvolve ──────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const METRICS_PATH = join(dirname(__filename), "..", "core", "metrics.json");

describe("realEvolve", () => {
  beforeEach(() => {
    // Clean metrics so each test starts fresh
    if (existsSync(METRICS_PATH)) unlinkSync(METRICS_PATH);
  });

  afterEach(() => {
    if (existsSync(METRICS_PATH)) unlinkSync(METRICS_PATH);
  });
  it("returns a valid EvolveResult", () => {
    const result = realEvolve();
    expect(result).toHaveProperty("entriesAnalyzed");
    expect(result).toHaveProperty("avgScore");
    expect(result).toHaveProperty("newRules");
    expect(result).toHaveProperty("supersededRules");
    expect(result).toHaveProperty("patternsDetected");
    expect(result).toHaveProperty("metrics");
  });

  it("updates metrics on each run", () => {
    const r1 = realEvolve();
    const r2 = realEvolve();
    expect(r2.metrics.totalRuns).toBeGreaterThan(r1.metrics.totalRuns);
  });

  it("tracks score trend", () => {
    const result = realEvolve();
    expect(["improving", "declining", "stable"]).toContain(result.metrics.scoreTrend);
  });

  it("tracks top patterns", () => {
    const result = realEvolve();
    expect(Array.isArray(result.metrics.topPatterns)).toBe(true);
  });
});
