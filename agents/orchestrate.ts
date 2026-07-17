/**
 * orchestrate.ts — Multi-agent orchestration for VENUS
 *
 * 1. Agent Teams — group agents by specialization
 * 2. Task Decomposition — break complex tasks into subtasks
 * 3. Result Aggregation — combine results from multiple agents
 * 4. Agent Specialization — track which agents excel at what
 * 5. Leader Election — pick best agent to coordinate
 */

// ── Types ──────────────────────────────────────────────────────────

export type Specialization = "code" | "review" | "research" | "plan" | "test" | "general";

export interface AgentProfile {
  name: string;
  specializations: Specialization[];
  success_rate: number;
  tasks_completed: number;
  specializations_detail: Record<Specialization, { attempts: number; successes: number }>;
}

export interface Team {
  id: string;
  name: string;
  lead: string | null;
  members: string[];
  specialization: Specialization;
}

export interface Subtask {
  id: string;
  description: string;
  required_specialization: Specialization;
  dependencies: string[]; // subtask IDs this depends on
  status: "pending" | "assigned" | "running" | "completed" | "failed";
  assigned_agent: string | null;
  result: SubtaskResult | null;
}

export interface SubtaskResult {
  subtask_id: string;
  agent: string;
  success: boolean;
  output: unknown;
  duration_ms: number;
}

export interface AggregatedResult {
  task_id: string;
  success: boolean;
  results: SubtaskResult[];
  summary: string;
  total_duration_ms: number;
}

export interface DecomposedTask {
  task_id: string;
  original_task: string;
  subtasks: Subtask[];
}

// ── Agent Specialization Tracker ───────────────────────────────────

const specializationScores: Map<string, Record<Specialization, { attempts: number; successes: number }>> = new Map();

function getSpecializations(agentName: string): Record<Specialization, { attempts: number; successes: number }> {
  if (!specializationScores.has(agentName)) {
    specializationScores.set(agentName, {
      code: { attempts: 0, successes: 0 },
      review: { attempts: 0, successes: 0 },
      research: { attempts: 0, successes: 0 },
      plan: { attempts: 0, successes: 0 },
      test: { attempts: 0, successes: 0 },
      general: { attempts: 0, successes: 0 },
    });
  }
  return specializationScores.get(agentName)!;
}

export function recordSpecialization(agentName: string, spec: Specialization, success: boolean): void {
  const specs = getSpecializations(agentName);
  specs[spec].attempts += 1;
  if (success) specs[spec].successes += 1;
}

export function getAgentSpecializations(agentName: string): Record<Specialization, { attempts: number; successes: number; rate: number }> {
  const specs = getSpecializations(agentName);
  const result: Record<string, { attempts: number; successes: number; rate: number }> = {};
  for (const [key, val] of Object.entries(specs)) {
    result[key] = {
      attempts: val.attempts,
      successes: val.successes,
      rate: val.attempts > 0 ? Math.round((val.successes / val.attempts) * 1000) / 1000 : 0,
    };
  }
  return result as Record<Specialization, { attempts: number; successes: number; rate: number }>;
}

export function getBestSpecialization(agentName: string): Specialization | null {
  const specs = getSpecializations(agentName);
  let best: Specialization | null = null;
  let bestRate = -1;
  for (const [key, val] of Object.entries(specs)) {
    if (val.attempts === 0) continue;
    const rate = val.successes / val.attempts;
    if (rate > bestRate || (rate === bestRate && val.attempts > (specs[best!]?.attempts ?? 0))) {
      bestRate = rate;
      best = key as Specialization;
    }
  }
  return best;
}

export function getTopAgentsForSpecialization(spec: Specialization, profiles: AgentProfile[]): AgentProfile[] {
  return profiles
    .filter((p) => p.specializations.includes(spec))
    .sort((a, b) => {
      const aDetail = a.specializations_detail[spec];
      const bDetail = b.specializations_detail[spec];
      const aRate = aDetail.attempts > 0 ? aDetail.successes / aDetail.attempts : 0;
      const bRate = bDetail.attempts > 0 ? bDetail.successes / bDetail.attempts : 0;
      if (bRate !== aRate) return bRate - aRate;
      return b.success_rate - a.success_rate;
    });
}

// ── Agent Teams ────────────────────────────────────────────────────

export function createTeam(
  id: string,
  name: string,
  members: string[],
  specialization: Specialization,
  lead: string | null = null
): Team {
  return {
    id,
    name,
    lead: lead ?? members[0] ?? null,
    members: [...members],
    specialization,
  };
}

export function getTeamMembers(team: Team, profiles: AgentProfile[]): AgentProfile[] {
  return profiles.filter((p) => team.members.includes(p.name));
}

export function assignToTeam(team: Team, agentName: string): Team {
  if (team.members.includes(agentName)) return team;
  return { ...team, members: [...team.members, agentName] };
}

export function removeFromTeam(team: Team, agentName: string): Team {
  if (!team.members.includes(agentName)) return team;
  const newMembers = team.members.filter((m) => m !== agentName);
  return {
    ...team,
    members: newMembers,
    lead: team.lead === agentName ? (newMembers[0] ?? null) : team.lead,
  };
}

export function selectTeamForTask(teams: Team[], spec: Specialization): Team | null {
  const candidates = teams.filter((t) => t.specialization === spec || t.specialization === "general");
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.members.length - a.members.length)[0];
}

// ── Task Decomposition ─────────────────────────────────────────────

const SPEC_KEYWORDS: Record<Specialization, string[]> = {
  review: ["review", "audit", "lint", "inspect"],
  test: ["test", "verify", "assert", "spec", "coverage"],
  code: ["implement", "write", "build", "create", "fix", "refactor", "code", "develop"],
  research: ["research", "investigate", "find", "search", "analyze", "compare"],
  plan: ["plan", "decompose", "architect", "design", "strategy", "organize"],
  general: [],
};

export function inferSpecialization(description: string): Specialization {
  const lower = description.toLowerCase();
  let bestSpec: Specialization = "general";
  let bestScore = 0;
  for (const [spec, keywords] of Object.entries(SPEC_KEYWORDS)) {
    if (spec === "general") continue;
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestSpec = spec as Specialization;
    }
  }
  return bestSpec;
}

export function decomposeTask(task: string): DecomposedTask {
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lower = task.toLowerCase();

  // Detect multi-step patterns
  const steps = parseSteps(lower);
  if (steps.length >= 2) {
    return {
      task_id: taskId,
      original_task: task,
      subtasks: steps.map((step, i) => ({
        id: `${taskId}-sub-${i}`,
        description: step,
        required_specialization: inferSpecialization(step),
        dependencies: i > 0 ? [`${taskId}-sub-${i - 1}`] : [],
        status: "pending" as const,
        assigned_agent: null,
        result: null,
      })),
    };
  }

  // Single complex task — try to split by phases
  const phases = splitByPhases(task);
  if (phases.length >= 2) {
    return {
      task_id: taskId,
      original_task: task,
      subtasks: phases.map((phase, i) => ({
        id: `${taskId}-sub-${i}`,
        description: phase.desc,
        required_specialization: phase.spec,
        dependencies: i > 0 ? [`${taskId}-sub-${i - 1}`] : [],
        status: "pending" as const,
        assigned_agent: null,
        result: null,
      })),
    };
  }

  // Cannot decompose further
  return {
    task_id: taskId,
    original_task: task,
    subtasks: [
      {
        id: `${taskId}-sub-0`,
        description: task,
        required_specialization: inferSpecialization(task),
        dependencies: [],
        status: "pending",
        assigned_agent: null,
        result: null,
      },
    ],
  };
}

function parseSteps(text: string): string[] {
  // Match "1) ...", "1. ...", "step 1:", "- ..." patterns
  const numbered = text.match(/(?:\d+[\)\.]\s*|step\s+\d+[:\-]\s*|[-•]\s*)(.+)/g);
  if (numbered && numbered.length >= 2) {
    return numbered.map((s) => s.replace(/^\d+[\)\.]\s*|^step\s+\d+[:\-]\s*|^[-•]\s*/, "").trim());
  }
  return [];
}

interface Phase {
  desc: string;
  spec: Specialization;
}

function splitByPhases(task: string): Phase[] {
  const lower = task.toLowerCase();
  const phases: Phase[] = [];

  const phasePatterns: { pattern: RegExp; spec: Specialization }[] = [
    { pattern: /first[\s,:]+(.+?)(?:\.|$)/, spec: "plan" },
    { pattern: /then[\s,:]+(.+?)(?:\.|$)/, spec: "code" },
    { pattern: /next[\s,:]+(.+?)(?:\.|$)/, spec: "code" },
    { pattern: /after(?:wards)?[\s,:]+(.+?)(?:\.|$)/, spec: "test" },
    { pattern: /finally[\s,:]+(.+?)(?:\.|$)/, spec: "review" },
    { pattern: /(?:and|also)[\s,:]+(.+?)(?:\.|$)/, spec: "general" },
  ];

  for (const { pattern, spec } of phasePatterns) {
    const match = lower.match(pattern);
    if (match) {
      phases.push({ desc: match[1].trim(), spec });
    }
  }

  return phases;
}

// ── Leader Election ────────────────────────────────────────────────

export function electLeader(profiles: AgentProfile[], taskSpec: Specialization): AgentProfile | null {
  if (profiles.length === 0) return null;

  // Score each agent: specialization fit + overall success rate + experience
  const scored = profiles.map((p) => {
    const specDetail = p.specializations_detail[taskSpec];
    const specRate = specDetail.attempts > 0 ? specDetail.successes / specDetail.attempts : 0;
    const specWeight = 0.5;
    const rateWeight = 0.3;
    const expWeight = 0.2;
    const expScore = Math.min(p.tasks_completed / 100, 1); // normalize

    return {
      agent: p,
      score: specRate * specWeight + p.success_rate * rateWeight + expScore * expWeight,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.agent ?? null;
}

// ── Result Aggregation ─────────────────────────────────────────────

export function aggregateResults(taskId: string, results: SubtaskResult[]): AggregatedResult {
  const allSuccess = results.every((r) => r.success);
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

  const summaries: string[] = [];
  for (const r of results) {
    summaries.push(`${r.agent}: ${r.success ? "✓" : "✗"} (${r.duration_ms}ms)`);
  }

  return {
    task_id: taskId,
    success: allSuccess,
    results,
    summary: summaries.join(" | "),
    total_duration_ms: totalDuration,
  };
}

// ── Orchestration Runner ───────────────────────────────────────────

export interface OrchestratorConfig {
  max_concurrent?: number;
  timeout_ms?: number;
}

export interface OrchestratorState {
  teams: Team[];
  agents: AgentProfile[];
  decomposed_tasks: DecomposedTask[];
  results: AggregatedResult[];
}

export function createOrchestrator(agents: AgentProfile[], teams: Team[]): OrchestratorState {
  return {
    teams,
    agents,
    decomposed_tasks: [],
    results: [],
  };
}

export function orchestrateTask(
  state: OrchestratorState,
  task: string
): { state: OrchestratorState; decomposition: DecomposedTask; team: Team | null; leader: AgentProfile | null } {
  const decomposition = decomposeTask(task);
  const spec = decomposition.subtasks[0]?.required_specialization ?? "general";
  const team = selectTeamForTask(state.teams, spec);
  const leader = team
    ? electLeader(
        state.agents.filter((a) => team.members.includes(a.name)),
        spec
      )
    : electLeader(state.agents, spec);

  return {
    state: {
      ...state,
      decomposed_tasks: [...state.decomposed_tasks, decomposition],
    },
    decomposition,
    team,
    leader,
  };
}

export function completeSubtask(
  state: OrchestratorState,
  taskId: string,
  subtaskId: string,
  result: SubtaskResult
): OrchestratorState {
  const tasks = state.decomposed_tasks.map((t) => {
    if (t.task_id !== taskId) return t;
    return {
      ...t,
      subtasks: t.subtasks.map((s) =>
        s.id === subtaskId
          ? { ...s, status: result.success ? "completed" : "failed", result }
          : s
      ),
    };
  });

  return { ...state, decomposed_tasks: tasks };
}

export function checkAllComplete(state: OrchestratorState, taskId: string): boolean | null {
  const task = state.decomposed_tasks.find((t) => t.task_id === taskId);
  if (!task) return null;
  return task.subtasks.every((s) => s.status === "completed" || s.status === "failed");
}

// ── Reset (for testing) ───────────────────────────────────────────

export function resetSpecializationScores(): void {
  specializationScores.clear();
}
