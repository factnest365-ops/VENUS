// skill-evolve.ts — Skill success tracking, auto-promotion/demotion, composition, marketplace

export type SkillStatus = "active" | "deprecated" | "experimental" | "composite";
export type SkillOutcome = "success" | "fail";

export interface SkillRecord {
  id: string;
  name: string;
  status: SkillStatus;
  successCount: number;
  failCount: number;
  lastUsed: number; // epoch ms
  createdAt: number;
  tags: string[];
  rating: number; // 0-5
  componentSkillIds?: string[]; // for composites
}

export interface SkillEvolveConfig {
  /** Minimum uses before promotion/demotion eligibility */
  minUses: number;
  /** Success rate threshold to promote to active (0-1) */
  promoteThreshold: number;
  /** Success rate threshold to demote to deprecated (0-1) */
  demoteThreshold: number;
  /** Decay factor per day for old outcomes (0-1, 1 = no decay) */
  dailyDecay: number;
  /** Max marketplace page size */
  pageSize: number;
}

export const DEFAULT_CONFIG: SkillEvolveConfig = {
  minUses: 5,
  promoteThreshold: 0.75,
  demoteThreshold: 0.25,
  dailyDecay: 0.98,
  pageSize: 10,
};

export interface SkillMarketplaceEntry {
  skill: SkillRecord;
  successRate: number;
  totalUses: number;
  decayedSuccessRate: number;
}

// ─── Internal state ───────────────────────────────────────────────
let skills: Map<string, SkillRecord> = new Map();
let outcomeLog: Map<string, Array<{ outcome: SkillOutcome; timestamp: number }>> =
  new Map();

export function resetSkills(): void {
  skills = new Map();
  outcomeLog = new Map();
}

// ─── Tracking ─────────────────────────────────────────────────────
export function recordOutcome(
  skillId: string,
  outcome: SkillOutcome,
  now = Date.now()
): void {
  const skill = skills.get(skillId);
  if (!skill) throw new Error(`Skill not found: ${skillId}`);

  skill.lastUsed = now;
  if (outcome === "success") skill.successCount++;
  else skill.failCount++;

  if (!outcomeLog.has(skillId)) outcomeLog.set(skillId, []);
  outcomeLog.get(skillId)!.push({ outcome, timestamp: now });
}

// ─── Decay ────────────────────────────────────────────────────────
function daysSince(ts: number, now = Date.now()): number {
  return Math.max(0, (now - ts) / (1000 * 60 * 60 * 24));
}

export function computeDecayedRate(
  skillId: string,
  config: SkillEvolveConfig = DEFAULT_CONFIG,
  now = Date.now()
): number {
  const log = outcomeLog.get(skillId) ?? [];
  if (log.length === 0) return 0;

  let weightedSuccess = 0;
  let weightedTotal = 0;

  for (const entry of log) {
    const age = daysSince(entry.timestamp, now);
    const weight = Math.pow(config.dailyDecay, age);
    weightedTotal += weight;
    if (entry.outcome === "success") weightedSuccess += weight;
  }

  return weightedTotal > 0 ? weightedSuccess / weightedTotal : 0;
}

export function getTotalUses(skillId: string): number {
  const log = outcomeLog.get(skillId) ?? [];
  return log.length;
}

// ─── Promotion / Demotion ─────────────────────────────────────────
export function evaluateSkillStatus(
  skillId: string,
  config: SkillEvolveConfig = DEFAULT_CONFIG,
  now = Date.now()
): SkillStatus {
  const skill = skills.get(skillId);
  if (!skill) throw new Error(`Skill not found: ${skillId}`);
  if (skill.status === "composite") return "composite"; // composites evaluated separately

  const total = skill.successCount + skill.failCount;
  if (total < config.minUses) return skill.status; // not enough data

  const successRate = skill.successCount / total;

  if (successRate >= config.promoteThreshold) return "active";
  if (successRate <= config.demoteThreshold) return "deprecated";
  return skill.status;
}

export function autoPromoteDemote(
  config: SkillEvolveConfig = DEFAULT_CONFIG,
  now = Date.now()
): Array<{ skillId: string; oldStatus: SkillStatus; newStatus: SkillStatus }> {
  const changes: Array<{ skillId: string; oldStatus: SkillStatus; newStatus: SkillStatus }> = [];

  for (const [id, skill] of skills) {
    if (skill.status === "composite") continue;
    const newStatus = evaluateSkillStatus(id, config, now);
    if (newStatus !== skill.status) {
      changes.push({ skillId: id, oldStatus: skill.status, newStatus });
      skill.status = newStatus;
    }
  }

  return changes;
}

// ─── Composition ──────────────────────────────────────────────────
export function createCompositeSkill(
  id: string,
  name: string,
  componentIds: string[],
  tags: string[] = [],
  now = Date.now()
): SkillRecord {
  for (const cid of componentIds) {
    if (!skills.has(cid)) throw new Error(`Component skill not found: ${cid}`);
  }
  if (componentIds.length < 2) throw new Error("Composite requires at least 2 skills");

  const composite: SkillRecord = {
    id,
    name,
    status: "composite",
    successCount: 0,
    failCount: 0,
    lastUsed: now,
    createdAt: now,
    tags,
    rating: 0,
    componentSkillIds: [...componentIds],
  };

  skills.set(id, composite);
  return composite;
}

export function getCompositeSuccessRate(
  skillId: string,
  config: SkillEvolveConfig = DEFAULT_CONFIG,
  now = Date.now()
): number {
  const skill = skills.get(skillId);
  if (!skill || skill.status !== "composite") return 0;
  if (!skill.componentSkillIds || skill.componentSkillIds.length === 0) return 0;

  let totalRate = 0;
  for (const cid of skill.componentSkillIds) {
    totalRate += computeDecayedRate(cid, config, now);
  }
  return totalRate / skill.componentSkillIds.length;
}

// ─── CRUD ─────────────────────────────────────────────────────────
export function registerSkill(
  id: string,
  name: string,
  tags: string[] = [],
  now = Date.now()
): SkillRecord {
  if (skills.has(id)) throw new Error(`Skill already exists: ${id}`);

  const skill: SkillRecord = {
    id,
    name,
    status: "experimental",
    successCount: 0,
    failCount: 0,
    lastUsed: now,
    createdAt: now,
    tags,
    rating: 0,
  };

  skills.set(id, skill);
  return skill;
}

export function getSkill(skillId: string): SkillRecord | undefined {
  return skills.get(skillId);
}

export function getAllSkills(): SkillRecord[] {
  return [...skills.values()];
}

export function deleteSkill(skillId: string): boolean {
  if (!skills.has(skillId)) return false;
  skills.delete(skillId);
  outcomeLog.delete(skillId);
  return true;
}

// ─── Rating ───────────────────────────────────────────────────────
export function rateSkill(skillId: string, rating: number): void {
  const skill = skills.get(skillId);
  if (!skill) throw new Error(`Skill not found: ${skillId}`);
  if (rating < 0 || rating > 5) throw new Error("Rating must be 0-5");
  skill.rating = rating;
}

// ─── Marketplace ──────────────────────────────────────────────────
export function listMarketplace(
  config: SkillEvolveConfig = DEFAULT_CONFIG,
  now = Date.now(),
  page = 0
): SkillMarketplaceEntry[] {
  const entries: SkillMarketplaceEntry[] = [];

  for (const skill of skills.values()) {
    const total = skill.successCount + skill.failCount;
    const successRate = total > 0 ? skill.successCount / total : 0;
    const decayedSuccessRate = computeDecayedRate(skill.id, config, now);

    entries.push({
      skill,
      successRate,
      totalUses: total,
      decayedSuccessRate,
    });
  }

  // Sort by decayed success rate descending, then rating
  entries.sort((a, b) => {
    if (b.decayedSuccessRate !== a.decayedSuccessRate)
      return b.decayedSuccessRate - a.decayedSuccessRate;
    return b.skill.rating - a.skill.rating;
  });

  return entries.slice(
    page * config.pageSize,
    (page + 1) * config.pageSize
  );
}

export function searchMarketplace(
  query: string,
  config: SkillEvolveConfig = DEFAULT_CONFIG,
  now = Date.now()
): SkillMarketplaceEntry[] {
  const q = query.toLowerCase();
  return listMarketplace(config, now, 0).filter(
    (e) =>
      e.skill.name.toLowerCase().includes(q) ||
      e.skill.tags.some((t) => t.toLowerCase().includes(q))
  );
}
