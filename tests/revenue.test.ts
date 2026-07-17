import { describe, it, expect } from "vitest";
import { createIntake, validateIntake } from "../money/intake";
import { scopeProject } from "../money/scoping";
import { generateInvoice } from "../money/invoice";

const VALID_INTAKE = {
  name: "Acme Corp",
  projectType: "web-app",
  budget: 50000,
  timeline: "3 months",
};

describe("intake", () => {
  it("createIntake returns valid intake", () => {
    const intake = createIntake(VALID_INTAKE);
    expect(intake.name).toBe("Acme Corp");
    expect(intake.budget).toBe(50000);
  });

  it("validateIntake rejects missing name", () => {
    expect(() => validateIntake({ ...VALID_INTAKE, name: "" })).toThrow();
  });

  it("validateIntake rejects negative budget", () => {
    expect(() => validateIntake({ ...VALID_INTAKE, budget: -100 })).toThrow();
  });

  it("validateIntake rejects non-object", () => {
    expect(() => validateIntake("garbage")).toThrow();
  });
});

describe("scoping", () => {
  const intake = createIntake(VALID_INTAKE);

  it("scopes project with valid task types", () => {
    const scope = scopeProject(intake, ["review", "bugfix"]);
    expect(scope.lineItems).toHaveLength(2);
    expect(scope.totalCredits).toBe(105); // 5 + 100
    expect(scope.estimatedHours).toBe(2); // ceil(105/100)
  });

  it("throws on unknown task type", () => {
    expect(() => scopeProject(intake, ["nonexistent"])).toThrow("Unknown task type");
  });

  it("handles empty task list", () => {
    const scope = scopeProject(intake, []);
    expect(scope.totalCredits).toBe(0);
    expect(scope.estimatedHours).toBe(0);
  });
});

describe("invoicing", () => {
  const intake = createIntake(VALID_INTAKE);
  const scope = scopeProject(intake, ["review", "bugfix"]);

  it("generates invoice with correct fields", () => {
    const inv = generateInvoice(scope, "Acme Corp");
    expect(inv.client).toBe("Acme Corp");
    expect(inv.lineItems).toHaveLength(2);
    expect(inv.totalCredits).toBe(105);
    expect(inv.estimatedHours).toBe(2);
    expect(inv.estimatedCost).toBe(300); // 2 hours × $150
    expect(inv.generatedAt).toBeDefined();
  });

  it("invoice has ISO timestamp", () => {
    const inv = generateInvoice(scope, "Test");
    expect(new Date(inv.generatedAt).toISOString()).toBe(inv.generatedAt);
  });
});
