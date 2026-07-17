import { describe, it, expect } from "vitest";
import {
  TASK_TYPES,
  estimateComplexity,
  complexityMultiplier,
  calculatePrice,
  executeTask,
  createTask,
} from "../money";

// ── Pricing ──────────────────────────────────────────────

describe("TASK_TYPES", () => {
  it("includes all four types", () => {
    expect(TASK_TYPES).toEqual(["code-gen", "review", "bugfix", "docs"]);
  });
});

describe("estimateComplexity", () => {
  it("returns 1 for trivial input", () => {
    expect(estimateComplexity("fix typo")).toBe(1);
  });

  it("scales up with length", () => {
    const short = estimateComplexity("short");
    const long = estimateComplexity("x".repeat(400));
    expect(long).toBeGreaterThan(short);
  });

  it("boosts score for complex keywords", () => {
    const plain = estimateComplexity("implement a feature");
    const complex = estimateComplexity("refactor the security architecture for performance");
    expect(complex).toBeGreaterThan(plain);
  });

  it("caps at 10", () => {
    expect(estimateComplexity("x".repeat(1000) + " refactor migrate parallel concurrent security")).toBeLessThanOrEqual(10);
  });

  it("floors at 1", () => {
    expect(estimateComplexity("")).toBeGreaterThanOrEqual(1);
  });
});

describe("complexityMultiplier", () => {
  it("returns 1 for complexity 1", () => {
    expect(complexityMultiplier(1)).toBe(1);
  });

  it("returns ~2.5 for complexity 10", () => {
    expect(complexityMultiplier(10)).toBeCloseTo(2.5, 1);
  });

  it("is monotonic", () => {
    for (let i = 2; i <= 10; i++) {
      expect(complexityMultiplier(i)).toBeGreaterThan(complexityMultiplier(i - 1));
    }
  });
});

describe("calculatePrice", () => {
  it("throws on unknown type", () => {
    // @ts-expect-error
    expect(() => calculatePrice("unknown", "desc")).toThrow("Unknown task type");
  });

  it("returns correct structure", () => {
    const price = calculatePrice("review", "review this PR");
    expect(price).toMatchObject({
      type: "review",
      label: "Code Review",
      baseCredits: 5,
    });
    expect(price.complexity).toBeGreaterThanOrEqual(1);
    expect(price.totalCredits).toBeGreaterThanOrEqual(0);
  });

  it("code-gen with 0 base stays 0 regardless of complexity", () => {
    const price = calculatePrice("code-gen", "refactor security architecture");
    expect(price.totalCredits).toBe(0);
  });

  it("bugfix with high complexity costs more than low", () => {
    const low = calculatePrice("bugfix", "fix typo");
    const high = calculatePrice("bugfix", "refactor migration architecture for performance and security");
    expect(high.totalCredits).toBeGreaterThanOrEqual(low.totalCredits);
  });
});

// ── Execution ────────────────────────────────────────────

describe("createTask", () => {
  it("creates a pending task with pricing", () => {
    const task = createTask("docs", "write README");
    expect(task.status).toBe("pending");
    expect(task.type).toBe("docs");
    expect(task.pricing).toBeDefined();
    expect(task.id).toMatch(/^task_/);
  });
});

describe("executeTask", () => {
  it("runs handler and completes", async () => {
    const result = await executeTask("code-gen", "generate auth module", async () => {
      return "auth code";
    });

    expect(result.success).toBe(true);
    expect(result.task.status).toBe("completed");
    expect(result.task.result).toBe("auth code");
    expect(result.task.completedAt).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("catches handler errors", async () => {
    const result = await executeTask("bugfix", "fix crash", async () => {
      throw new Error("cannot reproduce");
    });

    expect(result.success).toBe(false);
    expect(result.task.status).toBe("failed");
    expect(result.task.error).toBe("cannot reproduce");
  });

  it("handles non-Error throws", async () => {
    const result = await executeTask("review", "review", async () => {
      throw "string error";
    });

    expect(result.success).toBe(false);
    expect(result.task.error).toBe("string error");
  });

  it("each task gets a unique id", async () => {
    const a = executeTask("docs", "a", async () => "ok");
    const b = executeTask("docs", "b", async () => "ok");
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.task.id).not.toBe(rb.task.id);
  });

  it("records duration", async () => {
    const result = await executeTask("code-gen", "slow", async () => {
      await new Promise((r) => setTimeout(r, 50));
      return "done";
    });
    expect(result.duration).toBeGreaterThanOrEqual(40);
  });
});
