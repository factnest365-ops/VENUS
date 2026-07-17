import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

interface Action {
  type: "create" | "edit" | "delete" | "stop";
  target?: string;
  reason: string;
}

const __filename = fileURLToPath(import.meta.url);
const CORE = dirname(__filename);
const read = (f: string) => readFileSync(join(CORE, f), "utf-8");

let lastAction = "";
let repeatCount = 0;

export function resetEvolution(): void {
  lastAction = "";
  repeatCount = 0;
}

export function evolve(): Action {
  const rules = read("rules.md").toLowerCase();
  const patterns = read("patterns.md");
  const log = read("log.md");

  const lastLine = log.trim().split("\n").pop() ?? "";

  // rule 1: if log empty, bootstrap
  if (!log.trim()) {
    return { type: "stop", reason: "Log is empty — nothing to evolve from." };
  }

  // rule 2: check for STOP token in last log entry
  if (lastLine.includes("STOP")) {
    return { type: "stop", reason: "Last log entry has STOP. Halting." };
  }

  // rule 3: detect repetition
  const currentAction = rules.includes("prune") ? "delete-prune" : "default";
  if (currentAction === lastAction) {
    repeatCount++;
    if (repeatCount >= 2) {
      return { type: "stop", reason: "Same action repeated 2+ times. Halting to prevent loop." };
    }
  } else {
    lastAction = currentAction;
    repeatCount = 0;
  }

  // rule 4: if patterns exist, suggest creating from template
  if (patterns.includes("## template")) {
    return {
      type: "create",
      target: "new-pattern.md",
      reason: "Template found in patterns.md — time to create.",
    };
  }

  // rule 5: if rules mention "prune", suggest deletion (but with limits)
  if (rules.includes("prune") && repeatCount < 2) {
    return {
      type: "delete",
      target: "stale-files",
      reason: "Rules mention pruning. Clean up.",
    };
  }

  // rule 6: check log for failures
  if (log.includes("failure") || log.includes("error")) {
    return {
      type: "edit",
      target: "rules.md",
      reason: "Failures detected in log. Review rules.",
    };
  }

  // rule 7: check for low success rate patterns
  if (patterns.includes("success_rate: 0")) {
    return {
      type: "edit",
      target: "patterns.md",
      reason: "Low success patterns found. Refine or remove.",
    };
  }

  // default: edit patterns
  return {
    type: "edit",
    target: "patterns.md",
    reason: "No clear trigger — refine patterns.",
  };
}
