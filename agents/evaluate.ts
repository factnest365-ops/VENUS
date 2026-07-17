import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

interface Agent {
  name: string;
  type: string;
  success_rate: number;
  tasks_completed: number;
  description: string;
}

interface Registry {
  agents: Agent[];
  spawn_rules: { min_success_rate: number; max_concurrent: number };
}

const __dirname2 = path.dirname(__filename);
const REGISTRY_PATH = path.join(__dirname2, "registry.json");

function loadRegistry(): Registry {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
}

function saveRegistry(registry: Registry): void {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * Exponential moving average update.
 * new_rate = old_rate * decay + success * (1 - decay)
 * Weight shifts toward recent results without destroying history.
 */
function updateSuccessRate(oldRate: number, succeeded: boolean, decay = 0.8): number {
  const signal = succeeded ? 1 : 0;
  return Math.round((oldRate * decay + signal * (1 - decay)) * 1000) / 1000;
}

export interface TaskResult {
  agent: string;
  task_id: string;
  succeeded: boolean;
  duration_ms?: number;
  notes?: string;
}

export function recordResult(result: TaskResult): Agent | null {
  const registry = loadRegistry();
  const agent = registry.agents.find((a) => a.name === result.agent);
  if (!agent) return null;

  agent.success_rate = updateSuccessRate(agent.success_rate, result.succeeded);
  agent.tasks_completed += 1;

  saveRegistry(registry);
  return agent;
}

export function recordBatch(results: TaskResult[]): (Agent | null)[] {
  const registry = loadRegistry();

  for (const r of results) {
    const agent = registry.agents.find((a) => a.name === r.agent);
    if (!agent) continue;
    agent.success_rate = updateSuccessRate(agent.success_rate, r.succeeded);
    agent.tasks_completed += 1;
  }

  saveRegistry(registry);
  return results.map((r) => registry.agents.find((a) => a.name === r.agent) ?? null);
}

export function getLeaderboard(): { name: string; success_rate: number; tasks_completed: number }[] {
  return loadRegistry()
    .agents.sort((a, b) => b.success_rate - a.success_rate)
    .map(({ name, success_rate, tasks_completed }) => ({ name, success_rate, tasks_completed }));
}
