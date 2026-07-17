import * as fs from "fs";
import * as path from "path";

interface Agent {
  name: string;
  type: string;
  success_rate: number;
  tasks_completed: number;
  description: string;
}

interface SpawnRules {
  min_success_rate: number;
  max_concurrent: number;
}

interface Registry {
  agents: Agent[];
  spawn_rules: SpawnRules;
}

interface ActiveAgent {
  agent: string;
  task_id: string;
  started_at: number;
}

const REGISTRY_PATH = path.join(__dirname, "registry.json");
const ACTIVE_PATH = path.join(__dirname, "active.json");

function loadRegistry(): Registry {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
}

function loadActive(): ActiveAgent[] {
  if (!fs.existsSync(ACTIVE_PATH)) return [];
  return JSON.parse(fs.readFileSync(ACTIVE_PATH, "utf-8"));
}

function saveActive(active: ActiveAgent[]): void {
  fs.writeFileSync(ACTIVE_PATH, JSON.stringify(active, null, 2));
}

function taskMatchesAgent(task: string, agent: Agent): boolean {
  const lower = task.toLowerCase();
  const keywords: Record<string, string[]> = {
    coder: ["code", "implement", "write", "build", "create", "fix", "refactor"],
    reviewer: ["review", "audit", "check", "validate", "lint"],
    researcher: ["research", "investigate", "find", "search", "analyze", "compare"],
    planner: ["plan", "decompose", "architect", "design", "strategy"],
    tester: ["test", "verify", "validate", "assert", "spec"],
  };
  return keywords[agent.name]?.some((kw) => lower.includes(kw)) ?? false;
}

export function pickBestAgent(task: string): Agent | null {
  const registry = loadRegistry();
  const active = loadActive();
  const { min_success_rate, max_concurrent } = registry.spawn_rules;

  if (active.length >= max_concurrent) return null;

  const activeNames = new Set(active.map((a) => a.agent));

  const candidates = registry.agents
    .filter((a) => a.success_rate >= min_success_rate)
    .filter((a) => !activeNames.has(a.name))
    .filter((a) => taskMatchesAgent(task, a))
    .sort((a, b) => b.success_rate - a.success_rate);

  return candidates[0] ?? null;
}

export function spawnAgent(agentName: string, taskId: string): ActiveAgent | null {
  const registry = loadRegistry();
  const active = loadActive();

  const agent = registry.agents.find((a) => a.name === agentName);
  if (!agent) return null;
  if (active.length >= registry.spawn_rules.max_concurrent) return null;
  if (active.some((a) => a.agent === agentName)) return null;

  const record: ActiveAgent = { agent: agentName, task_id: taskId, started_at: Date.now() };
  active.push(record);
  saveActive(active);
  return record;
}

export function completeSpawn(taskId: string): void {
  const active = loadActive();
  const filtered = active.filter((a) => a.task_id !== taskId);
  saveActive(filtered);
}

export function getActiveAgents(): ActiveAgent[] {
  return loadActive();
}
