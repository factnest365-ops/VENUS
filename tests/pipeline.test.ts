import { describe, it, expect } from "vitest";
import {
  createTracker,
  startTracking,
  stopTracking,
  getBillableEntries,
  getTotalBillableHours,
  createPayment,
  processPayment,
  getPaymentSummary,
  createPipelineContext,
  runPipeline,
  getRevenueSummary,
} from "../money";

describe("Time Tracking", () => {
  it("tracks a task from start to stop", () => {
    let tracker = createTracker();
    const task = {
      id: "t1",
      type: "bugfix" as const,
      description: "Fix login bug",
      status: "running" as const,
      pricing: { type: "bugfix" as const, label: "Bug Fix", baseCredits: 100, complexity: 1, multiplier: 1, totalCredits: 100 },
      createdAt: Date.now(),
    };

    tracker = startTracking(tracker, task);
    expect(tracker.activeTaskId).toBe("t1");

    const { tracker: stopped, entry } = stopTracking(tracker);
    expect(stopped.activeTaskId).toBeNull();
    expect(entry.taskId).toBe("t1");
    expect(entry.endTime).toBeDefined();
  });

  it("throws if tracking while already active", () => {
    let tracker = createTracker();
    const task = { id: "t1", type: "bugfix" as const, description: "x", status: "running" as const, pricing: { type: "bugfix" as const, label: "", baseCredits: 100, complexity: 1, multiplier: 1, totalCredits: 100 }, createdAt: 0 };
    tracker = startTracking(tracker, task);
    expect(() => startTracking(tracker, task)).toThrow("Already tracking");
  });

  it("throws if stopping with no active task", () => {
    const tracker = createTracker();
    expect(() => stopTracking(tracker)).toThrow("No active task");
  });

  it("filters billable entries", () => {
    let tracker = createTracker();
    const t1 = { id: "t1", type: "bugfix" as const, description: "x", status: "running" as const, pricing: { type: "bugfix" as const, label: "", baseCredits: 100, complexity: 1, multiplier: 1, totalCredits: 100 }, createdAt: 0 };
    tracker = startTracking(tracker, t1);
    ({ tracker } = stopTracking(tracker));
    expect(getBillableEntries(tracker)).toHaveLength(1);
  });
});

describe("Payment", () => {
  it("creates a payment from invoice", () => {
    const invoice = {
      client: "Acme",
      projectType: "web",
      lineItems: [],
      totalCredits: 500,
      estimatedHours: 5,
      estimatedCost: 750,
      generatedAt: new Date().toISOString(),
    };
    const payment = createPayment(invoice, "stripe");
    expect(payment.client).toBe("Acme");
    expect(payment.amountUsd).toBe(750);
    expect(payment.status).toBe("pending");
  });

  it("processes payment successfully", async () => {
    const invoice = { client: "x", projectType: "x", lineItems: [], totalCredits: 100, estimatedHours: 1, estimatedCost: 150, generatedAt: "" };
    const payment = createPayment(invoice, "manual");
    const result = await processPayment(payment);
    expect(result.status).toBe("completed");
    expect(result.completedAt).toBeDefined();
  });

  it("fails on zero amount", async () => {
    const invoice = { client: "x", projectType: "x", lineItems: [], totalCredits: 0, estimatedHours: 0, estimatedCost: 0, generatedAt: "" };
    const payment = createPayment(invoice, "manual");
    const result = await processPayment(payment);
    expect(result.status).toBe("failed");
  });

  it("summarizes payments", () => {
    const p1 = { status: "completed" as const, amountUsd: 100 } as any;
    const p2 = { status: "pending" as const, amountUsd: 200 } as any;
    const summary = getPaymentSummary([p1, p2]);
    expect(summary.completed).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.totalRevenueUsd).toBe(100);
  });
});

describe("Pipeline", () => {
  it("runs full intake → scope → execute → invoice → payment", async () => {
    const ctx = createPipelineContext();
    const { result } = await runPipeline(
      ctx,
      { name: "TestCorp", projectType: "web-app", budget: 5000, timeline: "2 weeks" },
      "bugfix",
      "Fix critical auth bug",
      "stripe",
      async () => "Bug fixed successfully",
    );

    expect(result.intake.name).toBe("TestCorp");
    expect(result.scope.totalCredits).toBeGreaterThan(0);
    expect(result.execution.success).toBe(true);
    expect(result.invoice.totalCredits).toBeGreaterThan(0);
    expect(result.payment.status).toBe("completed");
    expect(result.timeEntry.endTime).toBeDefined();
  });

  it("tracks revenue across multiple runs", async () => {
    let ctx = createPipelineContext();

    const r1 = await runPipeline(ctx, { name: "A", projectType: "x", budget: 100, timeline: "1d" }, "bugfix", "fix a", "stripe", async () => "ok");
    ctx = r1.ctx;

    const r2 = await runPipeline(ctx, { name: "B", projectType: "y", budget: 200, timeline: "2d" }, "review", "review b", "manual", async () => "ok");
    ctx = r2.ctx;

    const summary = getRevenueSummary(ctx);
    expect(summary.totalClients).toBe(2);
    expect(summary.totalTasks).toBe(2);
    expect(summary.totalRevenueUsd).toBeGreaterThan(0);
    expect(summary.successRate).toBe(100);
  });

  it("handles execution failure", async () => {
    const ctx = createPipelineContext();
    const { result } = await runPipeline(
      ctx,
      { name: "FailCo", projectType: "x", budget: 100, timeline: "1d" },
      "bugfix",
      "will fail",
      "manual",
      async () => { throw new Error("boom"); },
    );

    expect(result.execution.success).toBe(false);
    expect(result.execution.task.error).toBe("boom");
    expect(result.payment.status).toBe("failed"); // $0 = fails
  });
});
