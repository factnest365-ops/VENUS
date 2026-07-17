import { readFileSync } from "fs";
import { join } from "path";
import type { Intake } from "./intake";

interface TaskDef {
  label: string;
  baseCredits: number;
  description: string;
}

const DEFAULT_TASKS: Record<string, TaskDef> = {
  "code-gen": { label: "Code Generation", baseCredits: 0, description: "Generate code from specification" },
  review: { label: "Code Review", baseCredits: 5, description: "Review code for quality and correctness" },
  bugfix: { label: "Bug Fix", baseCredits: 100, description: "Diagnose and fix a bug" },
  docs: { label: "Documentation", baseCredits: 0, description: "Write or update documentation" },
};

function loadTasks(): Record<string, TaskDef> {
  try {
    const raw = readFileSync(join(import.meta.dirname ?? ".", "tasks.json"), "utf-8");
    return JSON.parse(raw).taskTypes;
  } catch {
    return DEFAULT_TASKS;
  }
}

export interface ScopeEstimate {
  intake: Intake;
  taskTypes: string[];
  totalCredits: number;
  lineItems: { type: string; label: string; credits: number }[];
  estimatedHours: number;
}

export function scopeProject(intake: Intake, taskTypes: string[]): ScopeEstimate {
  const tasks = loadTasks();
  const lineItems = taskTypes.map((t) => {
    const def = tasks[t];
    if (!def) throw new Error(`Unknown task type: ${t}`);
    return { type: t, label: def.label, credits: def.baseCredits };
  });

  const totalCredits = lineItems.reduce((s, i) => s + i.credits, 0);
  const estimatedHours = Math.ceil(totalCredits / 100); // 100 credits ≈ 1 hour

  return { intake, taskTypes, totalCredits, lineItems, estimatedHours };
}
