import { describe, it, expect, beforeEach } from "vitest";
import {
  registerSkill,
  recordOutcome,
  computeDecayedRate,
  getTotalUses,
  evaluateSkillStatus,
  autoPromoteDemote,
  createCompositeSkill,
  getCompositeSuccessRate,
  getSkill,
  getAllSkills,
  deleteSkill,
  rateSkill,
  listMarketplace,
  searchMarketplace,
  resetSkills,
  DEFAULT_CONFIG,
  type SkillRecord,
  type SkillEvolveConfig,
  type SkillMarketplaceEntry,
} from "../skills/skill-evolve";

const NOW = Date.now();
const DAY = 86_400_000;

function makeConfig(overrides: Partial<SkillEvolveConfig> = {}): SkillEvolveConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

describe("skill-evolve", () => {
  beforeEach(() => {
    resetSkills();
  });

  // ─── Registration ──────────────────────────────────────────
  describe("registerSkill", () => {
    it("creates a skill with experimental status", () => {
      const s = registerSkill("a1", "Alpha", ["lang"], NOW);
      expect(s.id).toBe("a1");
      expect(s.name).toBe("Alpha");
      expect(s.status).toBe("experimental");
      expect(s.successCount).toBe(0);
      expect(s.failCount).toBe(0);
      expect(s.tags).toEqual(["lang"]);
    });

    it("throws on duplicate id", () => {
      registerSkill("a1", "Alpha", [], NOW);
      expect(() => registerSkill("a1", "Beta", [], NOW)).toThrow("already exists");
    });
  });

  // ─── CRUD helpers ──────────────────────────────────────────
  describe("getSkill / getAllSkills / deleteSkill", () => {
    it("getSkill returns undefined for unknown", () => {
      expect(getSkill("nope")).toBeUndefined();
    });

    it("getAllSkills returns all", () => {
      registerSkill("x", "X", [], NOW);
      registerSkill("y", "Y", [], NOW);
      expect(getAllSkills()).toHaveLength(2);
    });

    it("deleteSkill removes skill and outcomes", () => {
      registerSkill("d", "D", [], NOW);
      recordOutcome("d", "success", NOW);
      expect(deleteSkill("d")).toBe(true);
      expect(getSkill("d")).toBeUndefined();
      expect(getTotalUses("d")).toBe(0);
    });

    it("deleteSkill returns false for unknown", () => {
      expect(deleteSkill("nope")).toBe(false);
    });
  });

  // ─── Outcome tracking ──────────────────────────────────────
  describe("recordOutcome", () => {
    it("increments success count", () => {
      registerSkill("s", "S", [], NOW);
      recordOutcome("s", "success", NOW);
      expect(getSkill("s")!.successCount).toBe(1);
    });

    it("increments fail count", () => {
      registerSkill("s", "S", [], NOW);
      recordOutcome("s", "fail", NOW);
      expect(getSkill("s")!.failCount).toBe(1);
    });

    it("updates lastUsed", () => {
      registerSkill("s", "S", [], NOW);
      recordOutcome("s", "success", NOW + 1000);
      expect(getSkill("s")!.lastUsed).toBe(NOW + 1000);
    });

    it("throws for unknown skill", () => {
      expect(() => recordOutcome("nope", "success", NOW)).toThrow("not found");
    });

    it("tracks multiple outcomes", () => {
      registerSkill("s", "S", [], NOW);
      recordOutcome("s", "success", NOW);
      recordOutcome("s", "fail", NOW + DAY);
      recordOutcome("s", "success", NOW + 2 * DAY);
      expect(getSkill("s")!.successCount).toBe(2);
      expect(getSkill("s")!.failCount).toBe(1);
      expect(getTotalUses("s")).toBe(3);
    });
  });

  // ─── Decay ─────────────────────────────────────────────────
  describe("computeDecayedRate", () => {
    it("returns 0 for skill with no outcomes", () => {
      registerSkill("s", "S", [], NOW);
      expect(computeDecayedRate("s", DEFAULT_CONFIG, NOW)).toBe(0);
    });

    it("returns 1 for all-success recent outcomes", () => {
      registerSkill("s", "S", [], NOW);
      recordOutcome("s", "success", NOW);
      recordOutcome("s", "success", NOW);
      const rate = computeDecayedRate("s", DEFAULT_CONFIG, NOW);
      expect(rate).toBeCloseTo(1.0, 2);
    });

    it("old outcomes decay", () => {
      registerSkill("s", "S", [], NOW);
      // Success 30 days ago
      recordOutcome("s", "success", NOW - 30 * DAY);
      // Fail right now
      recordOutcome("s", "fail", NOW);

      const config = makeConfig({ dailyDecay: 0.95 });
      const rate = computeDecayedRate("s", config, NOW);
      // Old success has low weight, recent fail has high weight
      expect(rate).toBeLessThan(0.5);
    });

    it("recent outcomes have higher weight", () => {
      registerSkill("s", "S", [], NOW);
      // Success right now
      recordOutcome("s", "success", NOW);
      // Success 60 days ago
      recordOutcome("s", "success", NOW - 60 * DAY);

      const config = makeConfig({ dailyDecay: 0.95 });
      const rate = computeDecayedRate("s", config, NOW);
      // Both are successes so rate is still ~1
      expect(rate).toBeGreaterThan(0.9);
    });
  });

  // ─── Promotion / Demotion ──────────────────────────────────
  describe("evaluateSkillStatus", () => {
    it("stays experimental when below minUses", () => {
      registerSkill("s", "S", [], NOW);
      for (let i = 0; i < 3; i++) recordOutcome("s", "success", NOW);
      expect(evaluateSkillStatus("s", makeConfig({ minUses: 5 }))).toBe("experimental");
    });

    it("promotes to active when success rate >= threshold", () => {
      registerSkill("s", "S", [], NOW);
      // 4 success, 1 fail = 80% >= 75% threshold, 5 uses >= minUses
      for (let i = 0; i < 4; i++) recordOutcome("s", "success", NOW);
      recordOutcome("s", "fail", NOW);
      expect(evaluateSkillStatus("s", makeConfig({ minUses: 5 }))).toBe("active");
    });

    it("demotes to deprecated when success rate <= threshold", () => {
      registerSkill("s", "S", [], NOW);
      // 1 success, 4 fail = 20% <= 25% threshold
      recordOutcome("s", "success", NOW);
      for (let i = 0; i < 4; i++) recordOutcome("s", "fail", NOW);
      expect(evaluateSkillStatus("s", makeConfig({ minUses: 5 }))).toBe("deprecated");
    });

    it("keeps current status when rate is between thresholds", () => {
      registerSkill("s", "S", [], NOW);
      // 2 success, 3 fail = 40% — between 25% and 75%
      for (let i = 0; i < 2; i++) recordOutcome("s", "success", NOW);
      for (let i = 0; i < 3; i++) recordOutcome("s", "fail", NOW);
      expect(evaluateSkillStatus("s", makeConfig({ minUses: 5 }))).toBe("experimental");
    });

    it("throws for unknown skill", () => {
      expect(() => evaluateSkillStatus("nope")).toThrow("not found");
    });
  });

  describe("autoPromoteDemote", () => {
    it("returns empty array when no changes needed", () => {
      registerSkill("a", "A", [], NOW);
      registerSkill("b", "B", [], NOW);
      // Not enough uses
      for (let i = 0; i < 2; i++) recordOutcome("a", "success", NOW);
      expect(autoPromoteDemote(makeConfig({ minUses: 5 }))).toHaveLength(0);
    });

    it("promotes winning skills", () => {
      registerSkill("winner", "W", [], NOW);
      for (let i = 0; i < 8; i++) recordOutcome("winner", "success", NOW);
      recordOutcome("winner", "fail", NOW);

      const changes = autoPromoteDemote(makeConfig({ minUses: 5 }));
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        skillId: "winner",
        oldStatus: "experimental",
        newStatus: "active",
      });
      expect(getSkill("winner")!.status).toBe("active");
    });

    it("demotes losing skills", () => {
      registerSkill("loser", "L", [], NOW);
      for (let i = 0; i < 8; i++) recordOutcome("loser", "fail", NOW);
      recordOutcome("loser", "success", NOW);

      const changes = autoPromoteDemote(makeConfig({ minUses: 5 }));
      expect(changes).toHaveLength(1);
      expect(changes[0].newStatus).toBe("deprecated");
    });

    it("skips composite skills", () => {
      registerSkill("a", "A", [], NOW);
      registerSkill("b", "B", [], NOW);
      createCompositeSkill("comp", "Composite", ["a", "b"], [], NOW);
      // Give 'a' enough data to evaluate
      for (let i = 0; i < 10; i++) recordOutcome("a", "success", NOW);
      for (let i = 0; i < 10; i++) recordOutcome("b", "fail", NOW);

      const changes = autoPromoteDemote(makeConfig({ minUses: 5 }));
      // Both 'a' and 'b' change, but 'comp' is skipped
      expect(changes.every((c) => c.skillId !== "comp")).toBe(true);
    });
  });

  // ─── Composition ───────────────────────────────────────────
  describe("createCompositeSkill", () => {
    it("creates a composite skill", () => {
      registerSkill("a", "A", [], NOW);
      registerSkill("b", "B", [], NOW);
      const comp = createCompositeSkill("comp", "Comp", ["a", "b"], ["mix"], NOW);

      expect(comp.status).toBe("composite");
      expect(comp.componentSkillIds).toEqual(["a", "b"]);
    });

    it("throws if component skill not found", () => {
      registerSkill("a", "A", [], NOW);
      expect(() => createCompositeSkill("c", "C", ["a", "missing"])).toThrow(
        "Component skill not found: missing"
      );
    });

    it("throws if fewer than 2 components", () => {
      registerSkill("a", "A", [], NOW);
      expect(() => createCompositeSkill("c", "C", ["a"])).toThrow(
        "at least 2 skills"
      );
    });
  });

  describe("getCompositeSuccessRate", () => {
    it("returns 0 for non-composite skill", () => {
      registerSkill("a", "A", [], NOW);
      expect(getCompositeSuccessRate("a")).toBe(0);
    });

    it("averages component decayed rates", () => {
      registerSkill("a", "A", [], NOW);
      registerSkill("b", "B", [], NOW);
      recordOutcome("a", "success", NOW);
      recordOutcome("a", "success", NOW);
      recordOutcome("b", "fail", NOW);
      recordOutcome("b", "fail", NOW);

      const comp = createCompositeSkill("comp", "C", ["a", "b"], [], NOW);
      const rate = getCompositeSuccessRate("comp", DEFAULT_CONFIG, NOW);
      // a = 1.0, b = 0.0 → avg = 0.5
      expect(rate).toBeCloseTo(0.5, 2);
    });
  });

  // ─── Rating ────────────────────────────────────────────────
  describe("rateSkill", () => {
    it("sets rating on skill", () => {
      registerSkill("s", "S", [], NOW);
      rateSkill("s", 4.5);
      expect(getSkill("s")!.rating).toBe(4.5);
    });

    it("throws on invalid rating", () => {
      registerSkill("s", "S", [], NOW);
      expect(() => rateSkill("s", -1)).toThrow("0-5");
      expect(() => rateSkill("s", 6)).toThrow("0-5");
    });

    it("throws for unknown skill", () => {
      expect(() => rateSkill("nope", 3)).toThrow("not found");
    });
  });

  // ─── Marketplace ───────────────────────────────────────────
  describe("listMarketplace", () => {
    it("returns empty for no skills", () => {
      expect(listMarketplace()).toHaveLength(0);
    });

    it("sorts by decayed success rate desc, then rating", () => {
      registerSkill("b", "B", [], NOW);
      recordOutcome("b", "success", NOW);
      recordOutcome("b", "success", NOW);

      registerSkill("a", "A", [], NOW);
      recordOutcome("a", "success", NOW);
      rateSkill("a", 5);

      // Both 100% rate, but a has higher rating
      const entries = listMarketplace(DEFAULT_CONFIG, NOW);
      expect(entries[0].skill.id).toBe("a");
      expect(entries[0].skill.rating).toBe(5);
    });

    it("paginates correctly", () => {
      for (let i = 0; i < 15; i++) {
        registerSkill(`s${i}`, `S${i}`, [], NOW);
        recordOutcome(`s${i}`, "success", NOW);
      }
      const config = makeConfig({ pageSize: 5 });
      const page0 = listMarketplace(config, NOW, 0);
      const page1 = listMarketplace(config, NOW, 1);
      const page2 = listMarketplace(config, NOW, 2);
      expect(page0).toHaveLength(5);
      expect(page1).toHaveLength(5);
      expect(page2).toHaveLength(5);
      // No overlap
      const ids0 = page0.map((e) => e.skill.id);
      const ids1 = page1.map((e) => e.skill.id);
      expect(ids0.every((id) => !ids1.includes(id))).toBe(true);
    });

    it("includes successRate, totalUses, decayedSuccessRate", () => {
      registerSkill("s", "S", [], NOW);
      recordOutcome("s", "success", NOW);
      recordOutcome("s", "fail", NOW);

      const entries = listMarketplace(DEFAULT_CONFIG, NOW);
      expect(entries).toHaveLength(1);
      expect(entries[0].successRate).toBeCloseTo(0.5, 2);
      expect(entries[0].totalUses).toBe(2);
      expect(typeof entries[0].decayedSuccessRate).toBe("number");
    });
  });

  describe("searchMarketplace", () => {
    it("filters by name", () => {
      registerSkill("a", "Alpha", [], NOW);
      registerSkill("b", "Beta", [], NOW);
      recordOutcome("a", "success", NOW);
      recordOutcome("b", "success", NOW);

      const results = searchMarketplace("alpha");
      expect(results).toHaveLength(1);
      expect(results[0].skill.name).toBe("Alpha");
    });

    it("filters by tag", () => {
      registerSkill("a", "A", ["web", "fast"], NOW);
      registerSkill("b", "B", ["data"], NOW);
      recordOutcome("a", "success", NOW);
      recordOutcome("b", "success", NOW);

      const results = searchMarketplace("web");
      expect(results).toHaveLength(1);
      expect(results[0].skill.id).toBe("a");
    });

    it("returns empty on no match", () => {
      registerSkill("a", "A", [], NOW);
      expect(searchMarketplace("zzz")).toHaveLength(0);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────
  describe("edge cases", () => {
    it("computeDecayedRate with unknown skill returns 0", () => {
      expect(computeDecayedRate("nope")).toBe(0);
    });

    it("getTotalUses returns 0 for unknown skill", () => {
      expect(getTotalUses("nope")).toBe(0);
    });

    it("dailyDecay=1 means no decay", () => {
      registerSkill("s", "S", [], NOW);
      recordOutcome("s", "success", NOW - 365 * DAY);
      const config = makeConfig({ dailyDecay: 1 });
      const rate = computeDecayedRate("s", config, NOW);
      expect(rate).toBeCloseTo(1.0, 2);
    });

    it("dailyDecay=0 means only most recent matters", () => {
      registerSkill("s", "S", [], NOW);
      recordOutcome("s", "success", NOW - DAY);
      recordOutcome("s", "fail", NOW);
      const config = makeConfig({ dailyDecay: 0 });
      const rate = computeDecayedRate("s", config, NOW);
      // Only most recent (fail) has weight → rate = 0
      expect(rate).toBe(0);
    });
  });
});
