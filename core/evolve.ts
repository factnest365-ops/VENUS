import { readFileSync } from "fs";
import { join } from "path";

interface Action {
  type: "create" | "edit" | "delete" | "stop";
  target?: string;
  reason: string;
}

const CORE = __dirname;
const read = (f: string) => readFileSync(join(CORE, f), "utf-8");

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

  // rule 3: if patterns exist, suggest creating from template
  if (patterns.includes("## template")) {
    return {
      type: "create",
      target: "new-pattern.md",
      reason: "Template found in patterns.md — time to create.",
    };
  }

  // rule 4: if rules mention "prune", suggest deletion
  if (rules.includes("prune")) {
    return {
      type: "delete",
      target: "stale-files",
      reason: "Rules mention pruning. Clean up.",
    };
  }

  // default: edit the last touched thing
  return {
    type: "edit",
    target: "patterns.md",
    reason: "No clear trigger — refine patterns.",
  };
}
