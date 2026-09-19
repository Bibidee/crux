import { describe, expect, it } from "vitest";
import { validateCreateForm } from "./createForm";

const complete = { title: "T", question: "Q", rule: "R", outcomeA: "A", outcomeB: "B", policy: "P", sources: [{ url: "https://example.com", fact: "A clear fact" }], bounty: "0.1", hours: "48" };

describe("create form validation", () => {
  it("rejects empty initial financial fields", () => {
    expect(validateCreateForm({ ...complete, bounty: "", hours: "" })).toBeTruthy();
  });
  it("enforces the contract bounty range", () => {
    for (const bounty of ["0", "0.0009", "11"]) expect(validateCreateForm({ ...complete, bounty, hours: "48" })).toContain("Bounty");
    for (const bounty of ["abc", "1e2"]) expect(validateCreateForm({ ...complete, bounty, hours: "48" })).toContain("valid");
    for (const bounty of ["0.001", "1", "2", "5", "10"]) expect(validateCreateForm({ ...complete, bounty, hours: "48" })).toBeNull();
  });
  it("rejects an invalid duration", () => {
    expect(validateCreateForm({ ...complete, bounty: "0.1", hours: "0.1" })).toContain("window");
  });
  it("accepts a complete valid case", () => {
    expect(validateCreateForm(complete)).toBeNull();
  });
});
