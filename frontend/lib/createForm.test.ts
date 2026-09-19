import { describe, expect, it } from "vitest";
import { validateCreateForm } from "./createForm";

const complete = { title: "T", question: "Q", rule: "R", outcomeA: "A", outcomeB: "B", policy: "P", sources: [{ url: "https://example.com", fact: "A clear fact" }], bounty: "0.1", hours: "48" };

describe("create form validation", () => {
  it("rejects empty initial financial fields", () => {
    expect(validateCreateForm({ ...complete, bounty: "", hours: "" })).toBeTruthy();
  });
  it("rejects out-of-range bounty and duration", () => {
    expect(validateCreateForm({ ...complete, bounty: "0", hours: "48" })).toContain("Bounty");
    expect(validateCreateForm({ ...complete, bounty: "0.1", hours: "0.1" })).toContain("window");
  });
  it("accepts a complete valid case", () => {
    expect(validateCreateForm(complete)).toBeNull();
  });
});
