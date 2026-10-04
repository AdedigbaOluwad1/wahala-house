import { describe, expect, it } from "vitest";
import { rebalance } from "../src/ui/budgetMath";

describe("rebalance", () => {
  it("keeps the total at 1 and scales the others proportionally", () => {
    const out = rebalance({ a: 0.5, b: 0.3, c: 0.2 }, "a", 0.7);
    expect(out.a).toBeCloseTo(0.7);
    expect(out.b + out.c).toBeCloseTo(0.3);
    expect(out.b / out.c).toBeCloseTo(1.5);
  });
  it("spreads evenly when the others are all zero", () => {
    const out = rebalance({ a: 1, b: 0, c: 0 }, "a", 0.4);
    expect(out.b).toBeCloseTo(0.3);
    expect(out.c).toBeCloseTo(0.3);
  });
  it("clamps out-of-range values", () => {
    const out = rebalance({ a: 0.5, b: 0.5 }, "a", 2);
    expect(out).toEqual({ a: 1, b: 0 });
  });
});
