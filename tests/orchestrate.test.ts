import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types re-exported for convenience
  type Specialization,
  type AgentProfile,
  type Team,
  type Subtask,
  type SubtaskResult,
  type AggregatedResult,
  type DecomposedTask,
  type OrchestratorState,
  // 1. Agent Teams
  createTeam,
  getTeamMembers,
  assignToTeam,
  removeFromTeam,
  selectTeamForTask,
  // 2. Task Decomposition
  decomposeTask,
  inferSpecialization,
  // 3. Result Aggregation
  aggregateResults,
  // 4. Agent Specialization
  recordSpecialization,
  getAgentSpecializations,
  getBestSpecialization,
  getTopAgentsForSpecialization,
  // 5. Leader Election
  electLeader,
  // Orchestrator
  createOrchestrator,
  orchestrateTask,
  completeSubtask,
  checkAllComplete,
  // Reset
  resetSpecializationScores,
} from "../agents/orchestrate";

// ── Fixtures ───────────────────────────────────────────────────────

function makeProfile(
  name: string,
  overrides: Partial<AgentProfile> = {}
): AgentProfile {
  const defaultDetail = {
    code: { attempts: 0, successes: 0 },
    review: { attempts: 0, successes: 0 },
    research: { attempts: 0, successes: 0 },
    plan: { attempts: 0, successes: 0 },
    test: { attempts: 0, successes: 0 },
    general: { attempts: 0, successes: 0 },
  };
  return {
    name,
    specializations: ["general"],
    success_rate: 0.8,
    tasks_completed: 5,
    specializations_detail: { ...defaultDetail },
    ...overrides,
  };
}

function makeCoderProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return makeProfile("coder", {
    specializations: ["code"],
    success_rate: 0.9,
    tasks_completed: 20,
    specializations_detail: {
      code: { attempts: 20, successes: 18 },
      review: { attempts: 2, successes: 1 },
      research: { attempts: 0, successes: 0 },
      plan: { attempts: 0, successes: 0 },
      test: { attempts: 3, successes: 2 },
      general: { attempts: 0, successes: 0 },
    },
    ...overrides,
  });
}

function makeReviewerProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return makeProfile("reviewer", {
    specializations: ["review"],
    success_rate: 0.95,
    tasks_completed: 15,
    specializations_detail: {
      code: { attempts: 0, successes: 0 },
      review: { attempts: 15, successes: 14 },
      research: { attempts: 0, successes: 0 },
      plan: { attempts: 0, successes: 0 },
      test: { attempts: 2, successes: 2 },
      general: { attempts: 0, successes: 0 },
    },
    ...overrides,
  });
}

function makeTesterProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return makeProfile("tester", {
    specializations: ["test"],
    success_rate: 0.85,
    tasks_completed: 10,
    specializations_detail: {
      code: { attempts: 0, successes: 0 },
      review: { attempts: 0, successes: 0 },
      research: { attempts: 0, successes: 0 },
      plan: { attempts: 0, successes: 0 },
      test: { attempts: 10, successes: 8 },
      general: { attempts: 0, successes: 0 },
    },
    ...overrides,
  });
}

function makeResearcherProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return makeProfile("researcher", {
    specializations: ["research"],
    success_rate: 0.88,
    tasks_completed: 8,
    specializations_detail: {
      code: { attempts: 0, successes: 0 },
      review: { attempts: 0, successes: 0 },
      research: { attempts: 8, successes: 7 },
      plan: { attempts: 0, successes: 0 },
      test: { attempts: 0, successes: 0 },
      general: { attempts: 0, successes: 0 },
    },
    ...overrides,
  });
}

function makePlannerProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return makeProfile("planner", {
    specializations: ["plan"],
    success_rate: 0.92,
    tasks_completed: 12,
    specializations_detail: {
      code: { attempts: 0, successes: 0 },
      review: { attempts: 0, successes: 0 },
      research: { attempts: 2, successes: 1 },
      plan: { attempts: 12, successes: 11 },
      test: { attempts: 0, successes: 0 },
      general: { attempts: 0, successes: 0 },
    },
    ...overrides,
  });
}

function allProfiles(): AgentProfile[] {
  return [makeCoderProfile(), makeReviewerProfile(), makeTesterProfile(), makeResearcherProfile(), makePlannerProfile()];
}

function sampleSubtaskResult(success = true): SubtaskResult {
  return {
    subtask_id: "sub-1",
    agent: "coder",
    success,
    output: success ? "done" : null,
    duration_ms: 150,
  };
}

// ── 1. Agent Teams ─────────────────────────────────────────────────

describe("Agent Teams", () => {
  describe("createTeam", () => {
    it("creates a team with given config", () => {
      const team = createTeam("t1", "Build Team", ["coder", "tester"], "code");
      expect(team.id).toBe("t1");
      expect(team.name).toBe("Build Team");
      expect(team.members).toEqual(["coder", "tester"]);
      expect(team.specialization).toBe("code");
      expect(team.lead).toBe("coder"); // first member
    });

    it("uses explicit lead when provided", () => {
      const team = createTeam("t2", "Review", ["coder", "reviewer"], "review", "reviewer");
      expect(team.lead).toBe("reviewer");
    });

    it("handles empty members", () => {
      const team = createTeam("t3", "Empty", [], "general");
      expect(team.lead).toBeNull();
      expect(team.members).toEqual([]);
    });

    it("stores a copy of members, not the original array", () => {
      const members = ["coder"];
      const team = createTeam("t4", "Copy", members, "code");
      members.push("reviewer");
      expect(team.members).toEqual(["coder"]);
    });
  });

  describe("getTeamMembers", () => {
    it("returns matching profiles", () => {
      const team = createTeam("t1", "Team", ["coder", "reviewer"], "code");
      const profiles = allProfiles();
      const result = getTeamMembers(team, profiles);
      expect(result.length).toBe(2);
      expect(result.map((p) => p.name)).toEqual(["coder", "reviewer"]);
    });

    it("returns empty for non-matching profiles", () => {
      const team = createTeam("t1", "Team", ["ghost"], "code");
      const result = getTeamMembers(team, allProfiles());
      expect(result).toEqual([]);
    });
  });

  describe("assignToTeam", () => {
    it("adds agent to team", () => {
      const team = createTeam("t1", "Team", ["coder"], "code");
      const updated = assignToTeam(team, "reviewer");
      expect(updated.members).toEqual(["coder", "reviewer"]);
    });

    it("does not duplicate existing member", () => {
      const team = createTeam("t1", "Team", ["coder"], "code");
      const updated = assignToTeam(team, "coder");
      expect(updated.members).toEqual(["coder"]);
    });

    it("returns original team reference when no change", () => {
      const team = createTeam("t1", "Team", ["coder"], "code");
      const updated = assignToTeam(team, "coder");
      expect(updated).toBe(team);
    });
  });

  describe("removeFromTeam", () => {
    it("removes member from team", () => {
      const team = createTeam("t1", "Team", ["coder", "reviewer"], "code");
      const updated = removeFromTeam(team, "reviewer");
      expect(updated.members).toEqual(["coder"]);
    });

    it("removes lead and reassigns", () => {
      const team = createTeam("t1", "Team", ["coder", "reviewer"], "code", "coder");
      const updated = removeFromTeam(team, "coder");
      expect(updated.lead).toBe("reviewer");
      expect(updated.members).toEqual(["reviewer"]);
    });

    it("lead becomes null if last member removed", () => {
      const team = createTeam("t1", "Team", ["coder"], "code", "coder");
      const updated = removeFromTeam(team, "coder");
      expect(updated.lead).toBeNull();
      expect(updated.members).toEqual([]);
    });

    it("no-op for non-member", () => {
      const team = createTeam("t1", "Team", ["coder"], "code");
      const updated = removeFromTeam(team, "ghost");
      expect(updated).toBe(team);
    });
  });

  describe("selectTeamForTask", () => {
    it("selects team with matching specialization", () => {
      const codeTeam = createTeam("t1", "Code", ["coder"], "code");
      const reviewTeam = createTeam("t2", "Review", ["reviewer"], "review");
      const result = selectTeamForTask([codeTeam, reviewTeam], "code");
      expect(result?.id).toBe("t1");
    });

    it("falls back to general team", () => {
      const generalTeam = createTeam("t1", "General", ["planner"], "general");
      const result = selectTeamForTask([generalTeam], "code");
      expect(result?.id).toBe("t1");
    });

    it("returns null when no matching team", () => {
      const reviewTeam = createTeam("t1", "Review", ["reviewer"], "review");
      const result = selectTeamForTask([reviewTeam], "code");
      expect(result).toBeNull();
    });

    it("selects larger team when multiple match", () => {
      const smallTeam = createTeam("t1", "Small", ["coder"], "code");
      const bigTeam = createTeam("t2", "Big", ["coder", "reviewer", "tester"], "code");
      const result = selectTeamForTask([smallTeam, bigTeam], "code");
      expect(result?.id).toBe("t2");
    });
  });
});

// ── 2. Task Decomposition ──────────────────────────────────────────

describe("Task Decomposition", () => {
  describe("inferSpecialization", () => {
    it("infers code for implementation tasks", () => {
      expect(inferSpecialization("implement the login feature")).toBe("code");
    });

    it("infers review for audit tasks", () => {
      expect(inferSpecialization("review the code for issues")).toBe("review");
    });

    it("infers research for investigation tasks", () => {
      expect(inferSpecialization("research the best approach")).toBe("research");
    });

    it("infers plan for planning tasks", () => {
      expect(inferSpecialization("plan the architecture")).toBe("plan");
    });

    it("infers test for verification tasks", () => {
      expect(inferSpecialization("write tests for the API")).toBe("test");
    });

    it("returns general for ambiguous tasks", () => {
      expect(inferSpecialization("do the thing")).toBe("general");
    });

    it("case insensitive", () => {
      expect(inferSpecialization("IMPLEMENT THE FEATURE")).toBe("code");
    });
  });

  describe("decomposeTask", () => {
    it("creates a single subtask for simple task", () => {
      const result = decomposeTask("fix the typo");
      expect(result.subtasks.length).toBe(1);
      expect(result.subtasks[0].status).toBe("pending");
      expect(result.subtasks[0].dependencies).toEqual([]);
    });

    it("decomposes numbered steps", () => {
      const result = decomposeTask("1) Research the problem\n2) Implement the fix\n3) Test the solution");
      expect(result.subtasks.length).toBe(3);
      expect(result.subtasks[0].description).toContain("research");
      expect(result.subtasks[1].description).toContain("implement");
      expect(result.subtasks[2].description).toContain("test");
    });

    it("decomposes dash-prefixed steps", () => {
      const result = decomposeTask("- Write the code\n- Review the code\n- Test the code");
      expect(result.subtasks.length).toBe(3);
    });

    it("chains dependencies", () => {
      const result = decomposeTask("1) Plan\n2) Build\n3) Test");
      expect(result.subtasks[0].dependencies).toEqual([]);
      expect(result.subtasks[1].dependencies).toHaveLength(1);
      expect(result.subtasks[2].dependencies).toHaveLength(1);
    });

    it("infers specializations for each subtask", () => {
      const result = decomposeTask("1) Research the issue\n2) Implement the fix");
      expect(result.subtasks[0].required_specialization).toBe("research");
      expect(result.subtasks[1].required_specialization).toBe("code");
    });

    it("generates unique task IDs", () => {
      const r1 = decomposeTask("do something");
      const r2 = decomposeTask("do something");
      expect(r1.task_id).not.toBe(r2.task_id);
    });

    it("preserves original task text", () => {
      const text = "fix the critical bug";
      const result = decomposeTask(text);
      expect(result.original_task).toBe(text);
    });

    it("subtask IDs follow convention", () => {
      const result = decomposeTask("fix the bug");
      expect(result.subtasks[0].id).toMatch(/^task-.+-sub-0$/);
    });
  });
});

// ── 3. Result Aggregation ──────────────────────────────────────────

describe("Result Aggregation", () => {
  describe("aggregateResults", () => {
    it("all success yields success", () => {
      const results: SubtaskResult[] = [
        { subtask_id: "s1", agent: "coder", success: true, output: "a", duration_ms: 100 },
        { subtask_id: "s2", agent: "tester", success: true, output: "b", duration_ms: 200 },
      ];
      const agg = aggregateResults("task-1", results);
      expect(agg.success).toBe(true);
      expect(agg.results).toHaveLength(2);
      expect(agg.total_duration_ms).toBe(300);
    });

    it("any failure yields failure", () => {
      const results: SubtaskResult[] = [
        { subtask_id: "s1", agent: "coder", success: true, output: "a", duration_ms: 100 },
        { subtask_id: "s2", agent: "tester", success: false, output: null, duration_ms: 50 },
      ];
      const agg = aggregateResults("task-1", results);
      expect(agg.success).toBe(false);
    });

    it("summary contains agent status", () => {
      const results: SubtaskResult[] = [
        { subtask_id: "s1", agent: "coder", success: true, output: "a", duration_ms: 100 },
        { subtask_id: "s2", agent: "reviewer", success: false, output: null, duration_ms: 50 },
      ];
      const agg = aggregateResults("task-1", results);
      expect(agg.summary).toContain("coder: ✓");
      expect(agg.summary).toContain("reviewer: ✗");
    });

    it("preserves task ID", () => {
      const agg = aggregateResults("task-xyz", []);
      expect(agg.task_id).toBe("task-xyz");
    });

    it("empty results = success with zero duration", () => {
      const agg = aggregateResults("task-1", []);
      expect(agg.success).toBe(true);
      expect(agg.total_duration_ms).toBe(0);
    });

    it("duration sums correctly", () => {
      const results: SubtaskResult[] = [
        { subtask_id: "s1", agent: "a", success: true, output: null, duration_ms: 100 },
        { subtask_id: "s2", agent: "b", success: true, output: null, duration_ms: 200 },
        { subtask_id: "s3", agent: "c", success: true, output: null, duration_ms: 300 },
      ];
      const agg = aggregateResults("task-1", results);
      expect(agg.total_duration_ms).toBe(600);
    });
  });
});

// ── 4. Agent Specialization ────────────────────────────────────────

describe("Agent Specialization", () => {
  beforeEach(() => {
    resetSpecializationScores();
  });

  describe("recordSpecialization", () => {
    it("records a success", () => {
      recordSpecialization("coder", "code", true);
      const specs = getAgentSpecializations("coder");
      expect(specs.code.attempts).toBe(1);
      expect(specs.code.successes).toBe(1);
    });

    it("records a failure", () => {
      recordSpecialization("coder", "code", false);
      const specs = getAgentSpecializations("coder");
      expect(specs.code.attempts).toBe(1);
      expect(specs.code.successes).toBe(0);
    });

    it("accumulates over multiple calls", () => {
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "code", false);
      const specs = getAgentSpecializations("coder");
      expect(specs.code.attempts).toBe(3);
      expect(specs.code.successes).toBe(2);
    });

    it("tracks different specializations independently", () => {
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "review", false);
      const specs = getAgentSpecializations("coder");
      expect(specs.code.attempts).toBe(1);
      expect(specs.review.attempts).toBe(1);
      expect(specs.code.successes).toBe(1);
      expect(specs.review.successes).toBe(0);
    });
  });

  describe("getAgentSpecializations", () => {
    it("returns zeroed specs for unknown agent", () => {
      const specs = getAgentSpecializations("ghost");
      expect(specs.code.attempts).toBe(0);
      expect(specs.code.rate).toBe(0);
    });

    it("includes rate field", () => {
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "code", false);
      const specs = getAgentSpecializations("coder");
      expect(specs.code.rate).toBeCloseTo(0.667, 2);
    });
  });

  describe("getBestSpecialization", () => {
    it("returns specialization with highest success rate", () => {
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "review", true);
      recordSpecialization("coder", "review", false);
      expect(getBestSpecialization("coder")).toBe("code");
    });

    it("returns null for agent with no history", () => {
      expect(getBestSpecialization("ghost")).toBeNull();
    });

    it("picks spec with more attempts when rates tie", () => {
      recordSpecialization("coder", "code", true);
      recordSpecialization("coder", "code", false); // 50%
      recordSpecialization("coder", "review", true); // 100% but 1 attempt
      recordSpecialization("coder", "review", false); // 50%
      // Both 50%, but code has more attempts
      expect(getBestSpecialization("coder")).toBe("code");
    });
  });

  describe("getTopAgentsForSpecialization", () => {
    it("returns agents sorted by specialization success rate", () => {
      const profiles = allProfiles();
      const top = getTopAgentsForSpecialization("code", profiles);
      expect(top[0].name).toBe("coder"); // 18/20 = 90%
    });

    it("falls back to overall success_rate when specialization rates tie", () => {
      const profiles = [
        makeProfile("a", {
          specializations: ["code"],
          success_rate: 0.9,
          specializations_detail: {
            code: { attempts: 0, successes: 0 },
            review: { attempts: 0, successes: 0 },
            research: { attempts: 0, successes: 0 },
            plan: { attempts: 0, successes: 0 },
            test: { attempts: 0, successes: 0 },
            general: { attempts: 0, successes: 0 },
          },
        }),
        makeProfile("b", {
          specializations: ["code"],
          success_rate: 0.7,
          specializations_detail: {
            code: { attempts: 0, successes: 0 },
            review: { attempts: 0, successes: 0 },
            research: { attempts: 0, successes: 0 },
            plan: { attempts: 0, successes: 0 },
            test: { attempts: 0, successes: 0 },
            general: { attempts: 0, successes: 0 },
          },
        }),
      ];
      // Both have 0 specialization attempts
      const top = getTopAgentsForSpecialization("code", profiles);
      expect(top.length).toBe(2);
      expect(top[0].name).toBe("a");
    });

    it("filters to agents with matching specialization", () => {
      const coderProfile = makeCoderProfile();
      coderProfile.specializations.push("test");
      coderProfile.specializations_detail.test = { attempts: 3, successes: 2 };
      const reviewerProfile = makeReviewerProfile();
      reviewerProfile.specializations.push("test");
      reviewerProfile.specializations_detail.test = { attempts: 2, successes: 2 };
      const profiles = [coderProfile, reviewerProfile, makeTesterProfile()];
      const top = getTopAgentsForSpecialization("test", profiles);
      const names = top.map((p) => p.name);
      expect(names).toContain("tester");
      expect(names).toContain("coder");
      expect(names).toContain("reviewer");
    });
  });
});

// ── 5. Leader Election ─────────────────────────────────────────────

describe("Leader Election", () => {
  it("picks agent with best specialization rate for task", () => {
    const profiles = allProfiles();
    const leader = electLeader(profiles, "code");
    expect(leader?.name).toBe("coder");
  });

  it("picks reviewer for review tasks", () => {
    const profiles = allProfiles();
    const leader = electLeader(profiles, "review");
    expect(leader?.name).toBe("reviewer");
  });

  it("picks tester for test tasks", () => {
    const profiles = allProfiles();
    const leader = electLeader(profiles, "test");
    // tester has test: 8/10, reviewer has test: 2/2, coder has test: 2/3
    // Reviewer wins with 100% rate, but tester has higher experience weight
    expect(["tester", "reviewer"]).toContain(leader?.name);
  });

  it("returns null for empty profiles", () => {
    expect(electLeader([], "code")).toBeNull();
  });

  it("considers overall success_rate as tiebreaker", () => {
    const p1 = makeProfile("a", {
      success_rate: 0.95,
      specializations_detail: {
        code: { attempts: 5, successes: 3 }, // 60% code
        review: { attempts: 0, successes: 0 },
        research: { attempts: 0, successes: 0 },
        plan: { attempts: 0, successes: 0 },
        test: { attempts: 0, successes: 0 },
        general: { attempts: 0, successes: 0 },
      },
    });
    const p2 = makeProfile("b", {
      success_rate: 0.85,
      specializations_detail: {
        code: { attempts: 5, successes: 3 }, // 60% code, same
        review: { attempts: 0, successes: 0 },
        research: { attempts: 0, successes: 0 },
        plan: { attempts: 0, successes: 0 },
        test: { attempts: 0, successes: 0 },
        general: { attempts: 0, successes: 0 },
      },
    });
    const leader = electLeader([p1, p2], "code");
    expect(leader?.name).toBe("a"); // higher overall rate
  });

  it("considers experience as secondary factor", () => {
    const p1 = makeProfile("a", {
      success_rate: 0.9,
      tasks_completed: 50,
      specializations_detail: {
        code: { attempts: 10, successes: 9 }, // 90%
        review: { attempts: 0, successes: 0 },
        research: { attempts: 0, successes: 0 },
        plan: { attempts: 0, successes: 0 },
        test: { attempts: 0, successes: 0 },
        general: { attempts: 0, successes: 0 },
      },
    });
    const p2 = makeProfile("b", {
      success_rate: 0.9,
      tasks_completed: 5,
      specializations_detail: {
        code: { attempts: 10, successes: 9 }, // 90%, same
        review: { attempts: 0, successes: 0 },
        research: { attempts: 0, successes: 0 },
        plan: { attempts: 0, successes: 0 },
        test: { attempts: 0, successes: 0 },
        general: { attempts: 0, successes: 0 },
      },
    });
    const leader = electLeader([p1, p2], "code");
    expect(leader?.name).toBe("a"); // more experience
  });
});

// ── Orchestrator Integration ───────────────────────────────────────

describe("Orchestrator", () => {
  beforeEach(() => {
    resetSpecializationScores();
  });

  describe("createOrchestrator", () => {
    it("creates initial state", () => {
      const profiles = allProfiles();
      const teams = [createTeam("t1", "Code", ["coder", "reviewer"], "code")];
      const state = createOrchestrator(profiles, teams);
      expect(state.agents).toHaveLength(5);
      expect(state.teams).toHaveLength(1);
      expect(state.decomposed_tasks).toEqual([]);
      expect(state.results).toEqual([]);
    });
  });

  describe("orchestrateTask", () => {
    it("decomposes and assigns", () => {
      const profiles = allProfiles();
      const teams = [createTeam("t1", "Code", ["coder", "reviewer"], "code")];
      let state = createOrchestrator(profiles, teams);
      const { state: newState, decomposition, team, leader } = orchestrateTask(state, "implement the login");
      state = newState;
      expect(decomposition.subtasks.length).toBeGreaterThanOrEqual(1);
      expect(team?.id).toBe("t1");
      expect(leader?.name).toBe("coder");
      expect(state.decomposed_tasks.length).toBe(1);
    });

    it("selects team by specialization", () => {
      const profiles = allProfiles();
      const teams = [
        createTeam("t1", "Code", ["coder"], "code"),
        createTeam("t2", "Test", ["tester"], "test"),
      ];
      const state = createOrchestrator(profiles, teams);
      const { team } = orchestrateTask(state, "test the API endpoints thoroughly");
      expect(team?.id).toBe("t2");
    });

    it("no team match falls back to leader from all agents", () => {
      const profiles = allProfiles();
      const teams = [createTeam("t1", "Review", ["reviewer"], "review")];
      const state = createOrchestrator(profiles, teams);
      const { team, leader } = orchestrateTask(state, "implement the feature");
      expect(team).toBeNull();
      expect(leader?.name).toBe("coder");
    });
  });

  describe("completeSubtask", () => {
    it("marks subtask as completed on success", () => {
      let state = createOrchestrator(allProfiles(), []);
      const { state: s1, decomposition } = orchestrateTask(state, "fix the bug");
      state = s1;
      const subtask = decomposition.subtasks[0];
      const result: SubtaskResult = {
        subtask_id: subtask.id,
        agent: "coder",
        success: true,
        output: "fixed",
        duration_ms: 100,
      };
      state = completeSubtask(state, decomposition.task_id, subtask.id, result);
      const task = state.decomposed_tasks.find((t) => t.task_id === decomposition.task_id);
      expect(task?.subtasks[0].status).toBe("completed");
      expect(task?.subtasks[0].result?.success).toBe(true);
    });

    it("marks subtask as failed on failure", () => {
      let state = createOrchestrator(allProfiles(), []);
      const { state: s1, decomposition } = orchestrateTask(state, "fix the bug");
      state = s1;
      const subtask = decomposition.subtasks[0];
      const result: SubtaskResult = {
        subtask_id: subtask.id,
        agent: "coder",
        success: false,
        output: null,
        duration_ms: 50,
      };
      state = completeSubtask(state, decomposition.task_id, subtask.id, result);
      const task = state.decomposed_tasks.find((t) => t.task_id === decomposition.task_id);
      expect(task?.subtasks[0].status).toBe("failed");
    });

    it("does not affect other subtasks", () => {
      let state = createOrchestrator(allProfiles(), []);
      state = orchestrateTask(state, "1) Plan\n2) Build\n3) Test").state;
      const task = state.decomposed_tasks[state.decomposed_tasks.length - 1];
      const result: SubtaskResult = {
        subtask_id: task.subtasks[0].id,
        agent: "planner",
        success: true,
        output: "planned",
        duration_ms: 100,
      };
      state = completeSubtask(state, task.task_id, task.subtasks[0].id, result);
      expect(task.subtasks[1].status).toBe("pending");
      expect(task.subtasks[2].status).toBe("pending");
    });
  });

  describe("checkAllComplete", () => {
    it("returns true when all subtasks are completed or failed", () => {
      let state = createOrchestrator(allProfiles(), []);
      state = orchestrateTask(state, "fix the bug").state;
      const task = state.decomposed_tasks[state.decomposed_tasks.length - 1];
      const result: SubtaskResult = {
        subtask_id: task.subtasks[0].id,
        agent: "coder",
        success: true,
        output: "done",
        duration_ms: 100,
      };
      state = completeSubtask(state, task.task_id, task.subtasks[0].id, result);
      expect(checkAllComplete(state, task.task_id)).toBe(true);
    });

    it("returns false when subtasks still pending", () => {
      let state = createOrchestrator(allProfiles(), []);
      state = orchestrateTask(state, "1) Plan\n2) Build").state;
      const task = state.decomposed_tasks[state.decomposed_tasks.length - 1];
      expect(checkAllComplete(state, task.task_id)).toBe(false);
    });

    it("returns null for unknown task", () => {
      const state = createOrchestrator(allProfiles(), []);
      expect(checkAllComplete(state, "nonexistent")).toBeNull();
    });

    it("treats failed subtasks as complete", () => {
      let state = createOrchestrator(allProfiles(), []);
      state = orchestrateTask(state, "fix the bug").state;
      const task = state.decomposed_tasks[state.decomposed_tasks.length - 1];
      const result: SubtaskResult = {
        subtask_id: task.subtasks[0].id,
        agent: "coder",
        success: false,
        output: null,
        duration_ms: 50,
      };
      state = completeSubtask(state, task.task_id, task.subtasks[0].id, result);
      expect(checkAllComplete(state, task.task_id)).toBe(true);
    });
  });

  describe("full orchestration flow", () => {
    it("multi-step task: decompose → assign → complete → check", () => {
      const profiles = allProfiles();
      const teams = [
        createTeam("code-team", "Code", ["coder"], "code"),
        createTeam("test-team", "Test", ["tester"], "test"),
      ];
      let state = createOrchestrator(profiles, teams);

      // Orchestrate a multi-step task
      const { state: s1, decomposition } = orchestrateTask(
        state,
        "1) Research the issue\n2) Implement the fix\n3) Test the solution"
      );
      state = s1;

      expect(decomposition.subtasks.length).toBe(3);
      expect(decomposition.subtasks[0].required_specialization).toBe("research");
      expect(decomposition.subtasks[1].required_specialization).toBe("code");
      expect(decomposition.subtasks[2].required_specialization).toBe("test");

      // Complete each subtask
      for (const sub of decomposition.subtasks) {
        const result: SubtaskResult = {
          subtask_id: sub.id,
          agent: sub.required_specialization === "code" ? "coder" : sub.required_specialization === "test" ? "tester" : "researcher",
          success: true,
          output: "done",
          duration_ms: 100,
        };
        state = completeSubtask(state, decomposition.task_id, sub.id, result);
      }

      // All complete
      expect(checkAllComplete(state, decomposition.task_id)).toBe(true);

      // Aggregate results
      const task = state.decomposed_tasks.find((t) => t.task_id === decomposition.task_id)!;
      const subResults = task.subtasks.map((s) => s.result!);
      const agg = aggregateResults(decomposition.task_id, subResults);
      expect(agg.success).toBe(true);
      expect(agg.results).toHaveLength(3);
      expect(agg.total_duration_ms).toBe(300);
    });
  });
});

// ── Edge Cases ─────────────────────────────────────────────────────

describe("Edge Cases", () => {
  beforeEach(() => {
    resetSpecializationScores();
  });

  it("decompose task with no recognizable pattern returns single subtask", () => {
    const result = decomposeTask("just do it");
    expect(result.subtasks.length).toBe(1);
    expect(result.subtasks[0].required_specialization).toBe("general");
  });

  it("team with no members has no leader", () => {
    const team = createTeam("t1", "Empty", [], "code");
    expect(team.lead).toBeNull();
    expect(team.members.length).toBe(0);
  });

  it("aggregate with single result", () => {
    const result = aggregateResults("t", [sampleSubtaskResult()]);
    expect(result.success).toBe(true);
    expect(result.results.length).toBe(1);
  });

  it("removeFromTeam preserves non-matching members", () => {
    const team = createTeam("t1", "Team", ["a", "b", "c"], "code");
    const updated = removeFromTeam(team, "b");
    expect(updated.members).toEqual(["a", "c"]);
  });

  it("orchestrateTask generates unique task IDs", () => {
    const state = createOrchestrator(allProfiles(), []);
    const { decomposition: d1 } = orchestrateTask(state, "do X");
    const { decomposition: d2 } = orchestrateTask(state, "do Y");
    expect(d1.task_id).not.toBe(d2.task_id);
  });

  it("inferSpecialization picks first matching keyword", () => {
    const spec = inferSpecialization("implement and review");
    expect(["code", "review"]).toContain(spec);
  });

  it("getTopAgentsForSpecialization with no agents returns empty", () => {
    expect(getTopAgentsForSpecialization("code", [])).toEqual([]);
  });

  it("completeSubtask on nonexistent task returns unchanged state", () => {
    const state = createOrchestrator(allProfiles(), []);
    const updated = completeSubtask(state, "nonexistent", "sub", sampleSubtaskResult());
    expect(updated.decomposed_tasks.length).toBe(0);
  });

  it("step decomposition handles numbered with periods", () => {
    const result = decomposeTask("1. First do this\n2. Then do that");
    expect(result.subtasks.length).toBe(2);
  });

  it("step decomposition handles 'step N:' pattern", () => {
    const result = decomposeTask("step 1: research\nstep 2: code");
    expect(result.subtasks.length).toBe(2);
  });
});
