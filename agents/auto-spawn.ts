/**
 * Phase 4: Intelligent Agent Auto-Spawner
 *
 * Full lifecycle: analyze → select → spawn → monitor → retry → record.
 * Agents are scored by keyword match × success rate × availability.
 * Failed spawns retry with exponential backoff up to maxRetries.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ── Types ──────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename);
const REGISTRY_PATH = path.join(__dirname2, "registry.json");
const ACTIVE_PATH = path.join(__dirname2, "active.json");

export interface Agent {
  name: string;
  type: string;
  success_rate: number;
  tasks_completed: number;
  description: string;
}

export interface SpawnRules {
  min_success_rate: number;
  max_concurrent: number;
}

export interface Registry {
  agents: Agent[];
  spawn_rules: SpawnRules;
}

export interface ActiveAgent {
  agent: string;
  task_id: string;
  started_at: number;
}

export interface TaskComplexity {
  score: number;          // 0-1 scale
  label: "trivial" | "simple" | "moderate" | "complex" | "critical";
  signals: string[];      // what drove the score
}

export interface SpawnConfig {
  timeout_ms: number;
  max_retries: number;
  retry_base_ms: number;
}

export interface SpawnResult {
  task_id: string;
  agent: string;
  succeeded: boolean;
  duration_ms: number;
  attempts: number;
  complexity: TaskComplexity;
  error?: string;
}

export interface AgentScore {
  name: string;
  keyword_score: number;
  success_score: number;
  availability_score: number;
  total: number;
}

// ── Defaults ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SpawnConfig = {
  timeout_ms: 30_000,
  max_retries: 2,
  retry_base_ms: 1_000,
};

// ── Keyword Map ────────────────────────────────────────────────────────

const KEYWORDS: Record<string, string[]> = {
  coder: ["code", "implement", "write", "build", "create", "fix", "refactor", "develop", "program"],
  reviewer: ["review", "audit", "check", "validate", "lint", "critique", "assess"],
  researcher: ["research", "investigate", "find", "search", "analyze", "compare", "discover"],
  planner: ["plan", "decompose", "architect", "design", "strategy", "organize", "roadmap"],
  tester: ["test", "verify", "validate", "assert", "spec", "qa", "benchmark"],
};

// ── Complexity Signals ─────────────────────────────────────────────────

const COMPLEXITY_SIGNALS: Record<string, { weight: number; label: string }[]> = {
  // High complexity markers
  "security":    { weight: 0.3, label: "security concern" },
  "migrate":     { weight: 0.25, label: "migration" },
  "refactor":    { weight: 0.2, label: "refactoring" },
  "architecture": { weight: 0.3, label: "architecture" },
  "concurrent":  { weight: 0.25, label: "concurrency" },
  "distributed": { weight: 0.3, label: "distributed system" },
  "optimize":    { weight: 0.2, label: "optimization" },
  // Moderate complexity
  "api":         { weight: 0.15, label: "API work" },
  "database":    { weight: 0.15, label: "database work" },
  "integrate":   { weight: 0.15, label: "integration" },
  "auth":        { weight: 0.2, label: "authentication" },
  // Simple markers
  "rename":      { weight: -0.1, label: "rename" },
  "format":      { weight: -0.15, label: "formatting" },
  "comment":     { weight: -0.15, label: "comments" },
  "readme":      { weight: -0.1, label: "documentation" },
};

// ── Registry I/O ───────────────────────────────────────────────────────

export function loadRegistry(): Registry {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
}

export function saveRegistry(registry: Registry): void {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

export function loadActive(): ActiveAgent[] {
  if (!fs.existsSync(ACTIVE_PATH)) return [];
  return JSON.parse(fs.readFileSync(ACTIVE_PATH, "utf-8"));
}

export function saveActive(active: ActiveAgent[]): void {
  fs.writeFileSync(ACTIVE_PATH, JSON.stringify(active, null, 2));
}

// ── 1. Complexity Analysis ────────────────────────────────────────────

export function analyzeComplexity(task: string): TaskComplexity {
  const lower = task.toLowerCase();
  const signals: string[] = [];
  let score = 0.3; // baseline: moderate-low

  for (const [keyword, info] of Object.entries(COMPLEXITY_SIGNALS)) {
    if (lower.includes(keyword)) {
      score += info.weight;
      signals.push(info.label);
    }
  }

  // Length-based heuristic
  const wordCount = task.split(/\s+/).length;
  if (wordCount > 30) {
    score += 0.1;
    signals.push("long description");
  }
  if (wordCount > 80) {
    score += 0.1;
    signals.push("very detailed spec");
  }

  // Multi-step markers
  if (/\d+\)/.test(task) || /step \d/.test(task) || /\n/.test(task)) {
    score += 0.1;
    signals.push("multi-step");
  }

  // Clamp
  score = Math.max(0, Math.min(1, score));

  let label: TaskComplexity["label"];
  if (score < 0.2) label = "trivial";
  else if (score < 0.4) label = "simple";
  else if (score < 0.6) label = "moderate";
  else if (score < 0.8) label = "complex";
  else label = "critical";

  return { score, label, signals };
}

// ── 2. Optimal Agent Selection ─────────────────────────────────────────

export function scoreAgents(task: string, complexity: TaskComplexity): AgentScore[] {
  const registry = loadRegistry();
  const active = loadActive();
  const activeNames = new Set(active.map((a) => a.agent));
  const { min_success_rate } = registry.spawn_rules;

  return registry.agents
    .filter((a) => a.success_rate >= min_success_rate)
    .map((agent) => {
      // Keyword relevance (0-1)
      const keywords = KEYWORDS[agent.name] ?? [];
      const lower = task.toLowerCase();
      const matches = keywords.filter((kw) => lower.includes(kw)).length;
      const keyword_score = Math.min(1, matches / Math.max(1, keywords.length) * 2);

      // Success rate directly
      const success_score = agent.success_rate;

      // Availability: 1.0 if free, 0.3 if busy (still possible but penalized)
      const availability_score = activeNames.has(agent.name) ? 0.3 : 1.0;

      // Type bonus: coordinators get boost on complex tasks
      const type_bonus = agent.type === "coordinator" && complexity.score > 0.6 ? 0.15 : 0;

      const total = keyword_score * 0.4 + success_score * 0.35 + availability_score * 0.25 + type_bonus;

      return {
        name: agent.name,
        keyword_score,
        success_score,
        availability_score,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function pickBestAgent(task: string): { agent: Agent; scores: AgentScore } | null {
  const registry = loadRegistry();
  const active = loadActive();
  const { max_concurrent } = registry.spawn_rules;

  if (active.length >= max_concurrent) return null;

  const complexity = analyzeComplexity(task);
  const scored = scoreAgents(task, complexity);
  if (!scored.length) return null;

  const best = scored[0];
  const agent = registry.agents.find((a) => a.name === best.name);
  if (!agent) return null;

  return { agent, scores: best };
}

// ── 3. Spawn with Timeout ──────────────────────────────────────────────

export function spawnAgent(agentName: string, taskId: string): ActiveAgent | null {
  const registry = loadRegistry();
  const active = loadActive();

  const agent = registry.agents.find((a) => a.name === agentName);
  if (!agent) return null;
  if (active.length >= registry.spawn_rules.max_concurrent) return null;
  if (active.some((a) => a.agent === agentName && a.task_id !== taskId)) return null;

  const record: ActiveAgent = { agent: agentName, task_id: taskId, started_at: Date.now() };
  active.push(record);
  saveActive(active);
  return record;
}

export function completeSpawn(taskId: string): void {
  const active = loadActive();
  saveActive(active.filter((a) => a.task_id !== taskId));
}

export function isTimedOut(taskId: string, timeout_ms: number): boolean {
  const active = loadActive();
  const record = active.find((a) => a.task_id === taskId);
  if (!record) return false;
  return Date.now() - record.started_at > timeout_ms;
}

// ── 4. Monitor Progress ────────────────────────────────────────────────

export function getProgress(taskId: string): {
  exists: boolean;
  elapsed_ms: number;
  timed_out: boolean;
  timeout_remaining_ms: number;
} | null {
  const active = loadActive();
  const record = active.find((a) => a.task_id === taskId);
  if (!record) return null;

  const elapsed = Date.now() - record.started_at;
  return {
    exists: true,
    elapsed_ms: elapsed,
    timed_out: false,         // caller decides threshold
    timeout_remaining_ms: Math.max(0, DEFAULT_CONFIG.timeout_ms - elapsed),
  };
}

// ── 5. Retry with Backoff ──────────────────────────────────────────────

export function createExecutor(
  taskFn: (agent: string, task: string) => Promise<boolean>,
  config: Partial<SpawnConfig> = {},
): (task: string) => Promise<SpawnResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return async (task: string): Promise<SpawnResult> => {
    const complexity = analyzeComplexity(task);
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let attempts = 0;
    let lastError = "";
    let lastAgent = "none";

    while (attempts <= cfg.max_retries) {
      attempts++;

      // Pick agent each attempt (in case previous one failed)
      const selection = pickBestAgent(task);
      if (!selection) {
        lastError = "No available agent";
        break;
      }

      const { agent } = selection;
      lastAgent = agent.name;
      const spawned = spawnAgent(agent.name, taskId);
      if (!spawned) {
        lastError = `Failed to spawn ${agent.name}`;
        break;
      }

      // Execute with timeout
      const start = Date.now();
      let succeeded = false;

      try {
        const taskPromise = taskFn(agent.name, task);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), cfg.timeout_ms),
        );

        succeeded = await Promise.race([taskPromise, timeoutPromise]);
      } catch (err: any) {
        succeeded = false;
        lastError = err?.message ?? "unknown error";
      }

      const duration = Date.now() - start;
      completeSpawn(taskId);

      if (succeeded) {
        return { task_id: taskId, agent: agent.name, succeeded: true, duration_ms: duration, attempts, complexity };
      }

      // Backoff before retry
      if (attempts <= cfg.max_retries) {
        const backoff = cfg.retry_base_ms * Math.pow(2, attempts - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    return {
      task_id: taskId,
      agent: lastAgent,
      succeeded: false,
      duration_ms: 0,
      attempts,
      complexity,
      error: lastError,
    };
  };
}

// ── 6. Update Success Rates ────────────────────────────────────────────

function updateSuccessRate(oldRate: number, succeeded: boolean, decay = 0.8): number {
  const signal = succeeded ? 1 : 0;
  return Math.round((oldRate * decay + signal * (1 - decay)) * 1000) / 1000;
}

export function recordResult(agentName: string, succeeded: boolean): Agent | null {
  const registry = loadRegistry();
  const agent = registry.agents.find((a) => a.name === agentName);
  if (!agent) return null;

  agent.success_rate = updateSuccessRate(agent.success_rate, succeeded);
  agent.tasks_completed += 1;

  saveRegistry(registry);
  return agent;
}

// ── High-Level Orchestrator ────────────────────────────────────────────

export async function autoSpawn(
  task: string,
  taskFn: (agent: string, task: string) => Promise<boolean>,
  config: Partial<SpawnConfig> = {},
): Promise<SpawnResult> {
  const executor = createExecutor(taskFn, config);
  const result = await executor(task);

  // Record the final outcome
  if (result.agent !== "none") {
    recordResult(result.agent, result.succeeded);
  }

  return result;
}

// ── Utilities ──────────────────────────────────────────────────────────

export function getActiveAgents(): ActiveAgent[] {
  return loadActive();
}

export function suggestAgent(task: string): { agent: string; score: number; complexity: TaskComplexity } | null {
  const complexity = analyzeComplexity(task);
  const scored = scoreAgents(task, complexity);
  if (!scored.length) return null;
  return { agent: scored[0].name, score: scored[0].total, complexity };
}
