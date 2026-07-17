/**
 * Revenue Pipeline
 *
 * End-to-end flow: intake → scope → execute → invoice → payment
 */

import { createIntake, type Intake } from "./intake";
import { scopeProject, type ScopeEstimate } from "./scoping";
import { executeTask, type Task, type ExecutionResult, type TaskType } from "./execute";
import { generateInvoice, type Invoice } from "./invoice";
import { createPayment, processPayment, type Payment, type PaymentMethod } from "./payment";
import { createTracker, startTracking, stopTracking, type TimeTracker, type TimeEntry } from "./timetrack";

export interface PipelineResult {
  intake: Intake;
  scope: ScopeEstimate;
  execution: ExecutionResult;
  invoice: Invoice;
  payment: Payment;
  timeEntry: TimeEntry;
}

export interface PipelineContext {
  tracker: TimeTracker;
  results: PipelineResult[];
}

export function createPipelineContext(): PipelineContext {
  return { tracker: createTracker(), results: [] };
}

/**
 * Run a single task through the full pipeline.
 *
 * 1. Validate intake
 * 2. Scope the project
 * 3. Execute the task (with time tracking)
 * 4. Generate invoice
 * 5. Process payment
 */
export async function runPipeline(
  ctx: PipelineContext,
  intakeData: { name: string; projectType: string; budget: number; timeline: string },
  taskType: TaskType,
  taskDescription: string,
  paymentMethod: PaymentMethod,
  handler: (task: Task) => Promise<string>,
): Promise<{ ctx: PipelineContext; result: PipelineResult }> {
  // 1. Intake
  const intake = createIntake(intakeData);

  // 2. Scope
  const scope = scopeProject(intake, [taskType]);

  // 3. Execute (with time tracking)
  const task: Task = {
    id: `task_${Date.now()}`,
    type: taskType,
    description: taskDescription,
    status: "running",
    pricing: scope.lineItems[0]
      ? { type: taskType, label: scope.lineItems[0].label, baseCredits: scope.lineItems[0].credits, complexity: 1, multiplier: 1, totalCredits: scope.lineItems[0].credits }
      : { type: taskType, label: "", baseCredits: 0, complexity: 1, multiplier: 1, totalCredits: 0 },
    createdAt: Date.now(),
  };

  ctx.tracker = startTracking(ctx.tracker, task);
  const execution = await executeTask(taskType, taskDescription, handler);
  const { tracker, entry: timeEntry } = stopTracking(ctx.tracker);
  ctx.tracker = tracker;

  // 4. Invoice
  const invoice = generateInvoice(scope, intake.name);

  // 5. Payment
  // If execution failed, skip real payment processing
  let paidPayment: Payment;
  if (!execution.success) {
    paidPayment = {
      ...createPayment(invoice, paymentMethod),
      status: "failed",
      error: execution.task.error || "Task execution failed",
      completedAt: Date.now(),
    };
  } else {
    const payment = createPayment(invoice, paymentMethod);
    paidPayment = await processPayment(payment);
  }

  const result: PipelineResult = { intake, scope, execution, invoice, payment: paidPayment, timeEntry };
  ctx.results.push(result);

  return { ctx, result };
}

/**
 * Get revenue summary across all pipeline runs.
 */
export function getRevenueSummary(ctx: PipelineContext): {
  totalClients: number;
  totalTasks: number;
  totalRevenueUsd: number;
  totalHoursTracked: number;
  successRate: number;
} {
  const clients = new Set(ctx.results.map((r) => r.intake.name));
  const successCount = ctx.results.filter((r) => r.execution.success && r.payment.status === "completed").length;
  const hours = ctx.tracker.entries
    .filter((e) => e.endTime)
    .reduce((sum, e) => sum + e.durationMs, 0) / 3_600_000;

  return {
    totalClients: clients.size,
    totalTasks: ctx.results.length,
    totalRevenueUsd: ctx.results
      .filter((r) => r.payment.status === "completed")
      .reduce((sum, r) => sum + r.payment.amountUsd, 0),
    totalHoursTracked: Math.round(hours * 100) / 100,
    successRate: ctx.results.length > 0 ? Math.round((successCount / ctx.results.length) * 100) : 0,
  };
}
