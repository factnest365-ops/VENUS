// VENUS Money Module — Full revenue pipeline
// intake → scope → execute → invoice → payment

// Pricing
export { TASK_TYPES, estimateComplexity, complexityMultiplier, calculatePrice } from "./pricing";
export type { TaskType, PriceBreakdown } from "./pricing";

// Execution
export { executeTask, createTask } from "./execute";
export type { Task, TaskStatus, ExecutionResult } from "./execute";

// Intake
export { createIntake, validateIntake } from "./intake";
export type { Intake } from "./intake";

// Scoping
export { scopeProject } from "./scoping";
export type { ScopeEstimate } from "./scoping";

// Invoice
export { generateInvoice } from "./invoice";
export type { Invoice, InvoiceLineItem } from "./invoice";

// Time Tracking
export { createTracker, startTracking, stopTracking, getBillableEntries, getTotalBillableMs, getTotalBillableHours, getEntriesByType } from "./timetrack";
export type { TimeEntry, TimeTracker } from "./timetrack";

// Payment
export { createPayment, processPayment, getPaymentSummary } from "./payment";
export type { Payment, PaymentStatus, PaymentMethod } from "./payment";

// Pipeline
export { createPipelineContext, runPipeline, getRevenueSummary } from "./pipeline";
export type { PipelineResult, PipelineContext } from "./pipeline";

// Task config
import tasks from "./tasks.json";
export const TASK_CONFIG = tasks;
