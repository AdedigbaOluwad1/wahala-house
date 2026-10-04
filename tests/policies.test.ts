import { describe, expect, it } from "vitest";
import {
  ADVISOR_IDS,
  DEFAULT_CONFIG,
  TICKS_PER_QUARTER,
  assemblyOdds,
  defaultBudget,
  enactPolicy,
  getPolicy,
  newGame,
  projectedFundingRatios,
  replay,
  runningCostPerTick,
  setBudget,
  stepTick,
} from "../src/engine";
import type { Action, GameConfig, GameState } from "../src/engine";
import { POLICIES } from "../src/content/policies";

const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({
  ...DEFAULT_CONFIG,
  seed: "pol",
  mode: "survival",
  ...over,
});
const run = (g: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    g.budgetWindowOpen = false;
    stepTick(g);
  }
};
const rich = (over: Partial<GameConfig> = {}) => {
  const g = newGame(cfg(over));
  g.national.treasury = 5000;
  g.national.assemblySupport = 100;
  return g;
};
const state = (g: GameState, id: string) => g.states.find((s) => s.id === id)!;

describe("policy content", () => {
  it("has the twelve v1 policies with complete fields", () => {
    expect(POLICIES).toHaveLength(12);
    const ids = new Set(POLICIES.map((p) => p.id));
    expect(ids.size).toBe(12);
    for (const p of POLICIES) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.effects.length).toBeGreaterThan(0);
      expect(p.delayTicks).toBeGreaterThanOrEqual(0);
      for (const a of ADVISOR_IDS)
        expect(p.advisorTake[a], `${p.id}:${a}`).toBeTruthy();
    }
  });
});

describe("enacting policies", () => {
  it.each(POLICIES.map((p) => [p.id]))(
    "%s lands main and side effects at their scheduled ticks",
    (id) => {
      const g = rich();
      const policy = getPolicy(id)!;
      const result = enactPolicy(g, id, { zone: "NE", sweetener: 0 });
      expect(result.ok).toBe(true);
      const scheduled = g.scheduled.filter((e) => e.policyId === id);
      expect(scheduled.length).toBe(
        policy.effects.length + policy.sideEffects.length,
      );
      const last = Math.max(...scheduled.map((e) => e.applyAtTick));
      for (const e of scheduled) expect(e.applyAtTick).toBeGreaterThan(g.tick);
      run(g, last - g.tick - 1);
      expect(g.scheduled.some((e) => e.policyId === id)).toBe(true);
      run(g, 1);
      expect(g.scheduled.some((e) => e.policyId === id)).toBe(false);
      expect(g.landed.filter((l) => l.policyId === id)).toHaveLength(
        scheduled.length,
      );
    },
  );

  it("charges the one-off cost and refuses when the treasury is short", () => {
    const g = rich();
    const before = g.national.treasury;
    enactPolicy(g, "recruit_police");
    expect(g.national.treasury).toBe(
      before - getPolicy("recruit_police")!.cost,
    );
    const poor = newGame(cfg());
    poor.national.treasury = 10;
    expect(enactPolicy(poor, "recruit_police")).toEqual({
      ok: false,
      reason: "insufficient_funds",
    });
    expect(poor.scheduled).toHaveLength(0);
  });

  it("does not allow a non-repeatable policy twice but allows a repeatable one after its cooldown", () => {
    const g = rich();
    expect(enactPolicy(g, "raise_vat").ok).toBe(true);
    expect(enactPolicy(g, "raise_vat")).toMatchObject({
      ok: false,
      reason: "already_active",
    });
    expect(enactPolicy(g, "military_surge")).toMatchObject({
      ok: false,
      reason: "zone_required",
    });
    expect(enactPolicy(g, "military_surge", { zone: "NE" }).ok).toBe(true);
    expect(enactPolicy(g, "military_surge", { zone: "NE" })).toMatchObject({
      ok: false,
      reason: "cooldown",
    });
    run(g, 27);
    expect(enactPolicy(g, "military_surge", { zone: "NW" }).ok).toBe(true);
  });

  it("military surge only changes the chosen zone", () => {
    const g = rich();
    const ne = state(g, "borno").security,
      sw = state(g, "lagos").security;
    enactPolicy(g, "military_surge", { zone: "NE" });
    run(g, 3);
    expect(state(g, "borno").security).toBeGreaterThan(ne);
    expect(state(g, "lagos").security).toBeLessThan(sw + 1);
  });

  it("removing the fuel subsidy trades treasury relief for inflation and mood", () => {
    const base = rich(),
      acted = rich();
    enactPolicy(acted, "remove_fuel_subsidy");
    run(base, 30);
    run(acted, 30);
    expect(acted.national.treasury).toBeGreaterThan(base.national.treasury);
    expect(acted.national.inflation).toBeGreaterThan(base.national.inflation);
    expect(state(acted, "oyo").mood).toBeLessThan(state(base, "oyo").mood);
  });

  it("running costs raise spending while active", () => {
    const g = rich();
    enactPolicy(g, "cash_transfer");
    expect(runningCostPerTick(g)).toBe(6);
    const surge = rich();
    enactPolicy(surge, "military_surge", { zone: "NE" });
    expect(runningCostPerTick(surge)).toBe(3);
    run(surge, 14);
    expect(runningCostPerTick(surge)).toBe(0);
  });

  it("refinery can be delayed by its delay risk, deterministically per seed", () => {
    const outcomes = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const g = rich({ seed: `ref-${i}` });
      const r = enactPolicy(g, "refinery_refurbishment");
      if (r.ok) outcomes.add(r.delayedBy);
    }
    expect([...outcomes].sort()).toEqual([0, 13]);
    const a = rich({ seed: "ref-1" }),
      b = rich({ seed: "ref-1" });
    expect(enactPolicy(a, "refinery_refurbishment")).toEqual(
      enactPolicy(b, "refinery_refurbishment"),
    );
  });
});

describe("assembly votes", () => {
  it("fails when support is far below the threshold, costing support and the sweetener but not the policy cost", () => {
    const g = newGame(cfg());
    g.national.treasury = 5000;
    g.national.assemblySupport = 10;
    const result = enactPolicy(g, "anticorruption_drive", { sweetener: 20 });
    expect(result).toMatchObject({ ok: false, reason: "vote_failed" });
    expect(g.national.assemblySupport).toBeLessThan(10);
    expect(g.national.treasury).toBe(5000 - 20);
    expect(g.scheduled).toHaveLength(0);
    expect(g.active).toHaveLength(0);
    expect(enactPolicy(g, "anticorruption_drive")).toMatchObject({
      ok: false,
      reason: "cooldown",
    });
  });

  it("passes when support is far above the threshold", () => {
    const g = rich();
    expect(enactPolicy(g, "anticorruption_drive")).toMatchObject({
      ok: true,
      vote: { passed: true },
    });
  });

  it("sweeteners raise the odds, capped at the maximum bonus", () => {
    const g = newGame(cfg());
    g.national.assemblySupport = 40;
    const policy = getPolicy("raise_vat")!;
    const none = assemblyOdds(g, policy, 0).chance;
    const some = assemblyOdds(g, policy, 80).chance;
    const huge = assemblyOdds(g, policy, 100000);
    expect(some).toBeGreaterThan(none);
    expect(huge.bonus).toBe(30);
  });

  it("is harder on brutal difficulty", () => {
    const easy = newGame(cfg({ difficulty: "easy" })),
      brutal = newGame(cfg({ difficulty: "brutal" }));
    const policy = getPolicy("raise_vat")!;
    expect(assemblyOdds(brutal, policy).needed).toBeGreaterThan(
      assemblyOdds(easy, policy).needed,
    );
  });
});

describe("budget projection and action replay", () => {
  it("reports higher funding ratios for sectors given larger shares", () => {
    const g = newGame(cfg());
    const base = projectedFundingRatios(g, defaultBudget());
    const b = defaultBudget();
    b.shares = { ...b.shares, security: 0.4, welfare: 0, economy: 0.02 };
    const heavy = projectedFundingRatios(g, b);
    expect(heavy.security).toBeGreaterThan(base.security);
    expect(heavy.welfare).toBe(0);
  });

  it("replays policy actions identically", () => {
    const actions: Action[] = [
      { tick: 0, type: "enactPolicy", policyId: "raise_vat", sweetener: 40 },
      { tick: 13, type: "setBudget", budget: defaultBudget() },
      { tick: 14, type: "enactPolicy", policyId: "cash_transfer" },
    ];
    const a = replay(cfg(), actions, 100),
      b = replay(cfg(), actions, 100);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.active.length).toBeGreaterThan(0);
  });

  it("allocation and budget changes made in a window carry across quarters", () => {
    const g = newGame(cfg());
    const b = defaultBudget();
    b.shares = { ...b.shares, health: 0.3, security: 0.04 };
    setBudget(g, b);
    run(g, TICKS_PER_QUARTER + 1);
    expect(g.budget.shares.health).toBe(0.3);
  });
});
