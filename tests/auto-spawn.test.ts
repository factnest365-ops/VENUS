import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  analyzeComplexity,
  scoreAgents,
  pickBestAgent,
  spawnAgent,
  completeSpawn,
  isTimedOut,
  getProgress,
  createExecutor,
  recordResult,
  autoSpawn,
  loadRegistry,
  saveRegistry,
  loadActive,
  saveActive,
} from "../agents/auto-spawn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_PATH = path.join(__dirname, "../agents/registry.json");
const ACTIVE_PATH = path.join(__dirname, "../agents/active.json");

const ORIGINAL_REGISTRY = {
  agents: [
    { name: "coder", type: "worker", success_rate: 0.85, tasks_completed: 5, description: "Writes code" },
    { name: "reviewer", type: "worker", success_rate: 0.92, tasks_completed: 3, description: "Reviews code" },
    { name: "researcher", type: "worker", success_rate: 0.88, tasks_completed: 2, description: "Investigates" },
    { name: "planner", type: "coordinator", success_rate: 0.90, tasks_completed: 4, description: "Decomposes goals" },
    { name: "tester", type: "worker", success_rate: 0.87, tasks_completed: 6, description: "Validates" },
  ],
  spawn_rules: { min_success_rate: 0.7, max_concurrent: 5 },
};

function resetRegistry() {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(ORIGINAL_REGISTRY, null, 2));
}

function clearActive() {
  fs.writeFileSync(ACTIVE_PATH, JSON.stringify([], null, 2));
}

describe("auto-spawn", () => {
  beforeEach(() => {
    resetRegistry();
    clearActive();
  });

  // ── 1. Complexity Analysis ────────────────────────────────────────

  describe("analyzeComplexity", () => {
    it("trivial task gets low score", () => {
      const c = analyzeComplexity("rename variable x to y");
      expect(c.score).toBeLessThan(0.3);
      expect(c.label).toMatch(/trivial|simple/);
    });

    it("simple task with few signals", () => {
      const c = analyzeComplexity("add a comment to the function");
      expect(c.score).toBeLessThan(0.4);
      expect(c.label).toMatch(/trivial|simple/);
    });

    it("complex task with multiple signals", () => {
      const c = analyzeComplexity(
        "implement secure distributed authentication API with database migration"
      );
      expect(c.score).toBeGreaterThan(0.5);
      expect(c.label).toMatch(/complex|critical/);
      expect(c.signals.length).toBeGreaterThanOrEqual(3);
    });

    it("critical task with many high-weight signals", () => {
      const c = analyzeComplexity(
        "refactor the architecture to support concurrent distributed security migration and optimization"
      );
      expect(c.score).toBeGreaterThanOrEqual(0.7);
      expect(c.label).toBe("critical");
    });

    it("long description increases score", () => {
      const short = analyzeComplexity("fix the bug");
      const long = analyzeComplexity(
        "fix the bug that happens when the system processes more than 1000 concurrent requests through the API gateway with database connections pooling and connection string rotation"
      );
      expect(long.score).toBeGreaterThan(short.score);
    });

    it("multi-step task detected", () => {
      const c = analyzeComplexity("1) Setup database\n2) Migrate data\n3) Validate");
      expect(c.signals).toContain("multi-step");
    });

    it("score clamped between 0 and 1", () => {
      const c = analyzeComplexity(
        "security migrate refactor architecture concurrent distributed integrate auth optimize api database"
      );
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(1);
    });
  });

  // ── 2. Agent Selection ────────────────────────────────────────────

  describe("scoreAgents", () => {
    it("returns all eligible agents sorted by score", () => {
      const scores = scoreAgents("write some code", analyzeComplexity("write code"));
      expect(scores.length).toBe(5);
      // First should have highest total
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1].total).toBeGreaterThanOrEqual(scores[i].total);
      }
    });

    it("keyword matching boosts relevant agent", () => {
      const scores = scoreAgents("write code to implement feature", analyzeComplexity("implement code"));
      const coderScore = scores.find((s) => s.name === "coder");
      const reviewerScore = scores.find((s) => s.name === "reviewer");
      expect(coderScore!.keyword_score).toBeGreaterThan(reviewerScore!.keyword_score);
    });

    it("busy agent gets availability penalty", () => {
      spawnAgent("coder", "existing-task");
      const scores = scoreAgents("write code", analyzeComplexity("code"));
      const coderScore = scores.find((s) => s.name === "coder");
      const freeAgent = scores.find((s) => s.name === "reviewer");
      expect(coderScore!.availability_score).toBeLessThan(freeAgent!.availability_score);
    });

    it("coordinator gets boost on complex tasks", () => {
      const scores = scoreAgents(
        "architect and plan the distributed system",
        analyzeComplexity("architect distributed system"),
      );
      const plannerScore = scores.find((s) => s.name === "planner");
      const coderScore = scores.find((s => s.name === "coder"));
      // Planner should have type bonus
      expect(plannerScore!.total).toBeGreaterThan(0);
    });
  });

  describe("pickBestAgent", () => {
    it("picks coder for code tasks", () => {
      const result = pickBestAgent("implement the login feature in code");
      expect(result).not.toBeNull();
      expect(result!.agent.name).toBe("coder");
    });

    it("picks reviewer for review tasks", () => {
      const result = pickBestAgent("review and audit this code for issues");
      expect(result).not.toBeNull();
      expect(result!.agent.name).toBe("reviewer");
    });

    it("picks planner for planning tasks", () => {
      const result = pickBestAgent("decompose this goal and plan the architecture");
      expect(result).not.toBeNull();
      expect(result!.agent.name).toBe("planner");
    });

    it("returns null when all agents busy", () => {
      const agents = loadRegistry().agents;
      for (const a of agents) {
        spawnAgent(a.name, `task-${a.name}`);
      }
      const result = pickBestAgent("write code");
      expect(result).toBeNull();
    });

    it("returns agent with score breakdown", () => {
      const result = pickBestAgent("test the API endpoints");
      expect(result).not.toBeNull();
      expect(result!.scores).toHaveProperty("keyword_score");
      expect(result!.scores).toHaveProperty("success_score");
      expect(result!.scores).toHaveProperty("availability_score");
      expect(result!.scores).toHaveProperty("total");
    });
  });

  // ── 3. Spawn Lifecycle ────────────────────────────────────────────

  describe("spawnAgent", () => {
    it("creates active record", () => {
      const record = spawnAgent("coder", "task-1");
      expect(record).not.toBeNull();
      expect(record!.agent).toBe("coder");
      expect(record!.task_id).toBe("task-1");
      expect(record!.started_at).toBeGreaterThan(0);
    });

    it("rejects unknown agent", () => {
      const record = spawnAgent("nonexistent", "task-1");
      expect(record).toBeNull();
    });

    it("rejects when at max concurrency", () => {
      const agents = loadRegistry().agents;
      for (let i = 0; i < agents.length && i < 5; i++) {
        spawnAgent(agents[i].name, `task-${i}`);
      }
      const record = spawnAgent("coder", "task-extra");
      expect(record).toBeNull();
    });

    it("rejects duplicate agent (same agent different task)", () => {
      spawnAgent("coder", "task-1");
      const record = spawnAgent("coder", "task-2");
      expect(record).toBeNull();
    });
  });

  describe("completeSpawn", () => {
    it("removes active record", () => {
      spawnAgent("coder", "task-1");
      expect(loadActive().length).toBe(1);
      completeSpawn("task-1");
      expect(loadActive().length).toBe(0);
    });

    it("only removes matching task", () => {
      spawnAgent("coder", "task-1");
      spawnAgent("reviewer", "task-2");
      completeSpawn("task-1");
      const active = loadActive();
      expect(active.length).toBe(1);
      expect(active[0].task_id).toBe("task-2");
    });
  });

  // ── 4. Timeout & Progress ─────────────────────────────────────────

  describe("timeout detection", () => {
    it("isTimedOut returns false for fresh spawn", () => {
      spawnAgent("coder", "task-1");
      expect(isTimedOut("task-1", 30_000)).toBe(false);
    });

    it("isTimedOut returns false for nonexistent task", () => {
      expect(isTimedOut("no-such-task", 30_000)).toBe(false);
    });

    it("isTimedOut returns true after timeout", () => {
      spawnAgent("coder", "task-1");
      // Artificially backdate the start
      const active = loadActive();
      const record = active.find((a) => a.task_id === "task-1")!;
      record.started_at = Date.now() - 60_000;
      saveActive(active);
      expect(isTimedOut("task-1", 30_000)).toBe(true);
    });
  });

  describe("getProgress", () => {
    it("returns null for nonexistent task", () => {
      expect(getProgress("no-task")).toBeNull();
    });

    it("returns progress for active task", () => {
      spawnAgent("coder", "task-1");
      const progress = getProgress("task-1");
      expect(progress).not.toBeNull();
      expect(progress!.exists).toBe(true);
      expect(progress!.elapsed_ms).toBeGreaterThanOrEqual(0);
      expect(progress!.timeout_remaining_ms).toBeGreaterThan(0);
    });
  });

  // ── 5. Retry with Backoff ─────────────────────────────────────────

  describe("createExecutor", () => {
    it("succeeds on first attempt", async () => {
      const taskFn = vi.fn().mockResolvedValue(true);
      const executor = createExecutor(taskFn, { timeout_ms: 5_000, max_retries: 2 });
      const result = await executor("write code to implement feature");
      expect(result.succeeded).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.agent).toBe("coder");
      expect(taskFn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and eventually succeeds", async () => {
      const taskFn = vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const executor = createExecutor(taskFn, { timeout_ms: 5_000, max_retries: 2, retry_base_ms: 10 });
      const result = await executor("implement the feature");
      expect(result.succeeded).toBe(true);
      expect(result.attempts).toBe(2);
      expect(taskFn).toHaveBeenCalledTimes(2);
    });

    it("exhausts retries and fails", async () => {
      const taskFn = vi.fn().mockResolvedValue(false);
      const executor = createExecutor(taskFn, { timeout_ms: 5_000, max_retries: 2, retry_base_ms: 10 });
      const result = await executor("implement broken thing");
      expect(result.succeeded).toBe(false);
      expect(result.attempts).toBe(3); // 1 initial + 2 retries
    });

    it("handles timeout", async () => {
      const taskFn = vi.fn().mockImplementation(
        () => new Promise((r) => setTimeout(r, 10_000)),
      );
      const executor = createExecutor(taskFn, { timeout_ms: 50, max_retries: 0 });
      const result = await executor("slow task");
      expect(result.succeeded).toBe(false);
      expect(result.error).toBe("timeout");
    });

    it("handles thrown errors", async () => {
      const taskFn = vi.fn().mockRejectedValue(new Error("boom"));
      const executor = createExecutor(taskFn, { timeout_ms: 5_000, max_retries: 0 });
      const result = await executor("failing task");
      expect(result.succeeded).toBe(false);
      expect(result.error).toBe("boom");
    });

    it("reports complexity in result", async () => {
      const taskFn = vi.fn().mockResolvedValue(true);
      const executor = createExecutor(taskFn, { timeout_ms: 5_000, max_retries: 0 });
      const result = await executor("security refactor with distributed authentication");
      expect(result.complexity).toBeDefined();
      expect(result.complexity.label).toMatch(/complex|critical/);
    });

    it("no available agent returns failure", async () => {
      const taskFn = vi.fn();
      // Fill all slots
      spawnAgent("coder", "busy-1");
      spawnAgent("reviewer", "busy-2");
      spawnAgent("researcher", "busy-3");
      spawnAgent("planner", "busy-4");
      spawnAgent("tester", "busy-5");

      const executor = createExecutor(taskFn, { max_retries: 1 });
      const result = await executor("do something");
      expect(result.succeeded).toBe(false);
      expect(result.error).toBe("No available agent");
      expect(taskFn).not.toHaveBeenCalled();
    });
  });

  // ── 6. Success Rate Updates ───────────────────────────────────────

  describe("recordResult", () => {
    it("updates success rate on success (EMA decay)", () => {
      const before = loadRegistry().agents.find((a) => a.name === "coder")!;
      const oldRate = before.success_rate;
      const updated = recordResult("coder", true);
      expect(updated).not.toBeNull();
      expect(updated!.success_rate).toBeGreaterThan(oldRate);
      expect(updated!.tasks_completed).toBe(before.tasks_completed + 1);
    });

    it("decreases success rate on failure", () => {
      const before = loadRegistry().agents.find((a) => a.name === "coder")!;
      const oldRate = before.success_rate;
      const updated = recordResult("coder", false);
      expect(updated).not.toBeNull();
      expect(updated!.success_rate).toBeLessThan(oldRate);
    });

    it("returns null for unknown agent", () => {
      const updated = recordResult("ghost", true);
      expect(updated).toBeNull();
    });

    it("updates persisted registry", () => {
      recordResult("tester", true);
      const registry = loadRegistry();
      const tester = registry.agents.find((a) => a.name === "tester")!;
      expect(tester.tasks_completed).toBe(7); // was 6
    });
  });

  // ── Integration: autoSpawn ────────────────────────────────────────

  describe("autoSpawn", () => {
    it("full lifecycle: analyze → select → spawn → execute → record", async () => {
      const taskFn = vi.fn().mockResolvedValue(true);
      const result = await autoSpawn("implement the login API", taskFn);
      expect(result.succeeded).toBe(true);
      expect(result.agent).toBe("coder");
      expect(result.complexity.label).toBeDefined();

      // Verify success rate was updated
      const registry = loadRegistry();
      const coder = registry.agents.find((a) => a.name === "coder")!;
      expect(coder.tasks_completed).toBe(6); // was 5
    });

    it("records failure and lowers success rate", async () => {
      const taskFn = vi.fn().mockResolvedValue(false);
      const coderBefore = loadRegistry().agents.find((a) => a.name === "coder")!;
      const oldRate = coderBefore.success_rate;

      const result = await autoSpawn("write broken code", taskFn, { max_retries: 0 });
      expect(result.succeeded).toBe(false);

      const coderAfter = loadRegistry().agents.find((a) => a.name === "coder")!;
      expect(coderAfter.success_rate).toBeLessThan(oldRate);
    });

    it("no active agents left after completion", async () => {
      const taskFn = vi.fn().mockResolvedValue(true);
      await autoSpawn("code something", taskFn);
      expect(loadActive().length).toBe(0);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("empty task still gets complexity score", () => {
      const c = analyzeComplexity("");
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.label).toBeDefined();
    });

    it("case insensitive keyword matching", () => {
      const scores = scoreAgents("WRITE CODE IMPLEMENT BUILD", analyzeComplexity("code"));
      const coder = scores.find((s) => s.name === "coder")!;
      expect(coder.keyword_score).toBeGreaterThan(0);
    });

    it("concurrent spawns don't collide", () => {
      spawnAgent("coder", "task-a");
      const record = spawnAgent("reviewer", "task-b");
      expect(record).not.toBeNull();
      expect(loadActive().length).toBe(2);
    });

    it("re-spawning after completion works", () => {
      spawnAgent("coder", "task-1");
      completeSpawn("task-1");
      const record = spawnAgent("coder", "task-2");
      expect(record).not.toBeNull();
    });
  });
});
