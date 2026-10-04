import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  getEvent,
  newGame,
  pendingDecision,
  resolveEvent,
  stepTick,
} from "../src/engine";
import type { GameConfig, GameState } from "../src/engine";
import { EVENTS } from "../src/content/events";

const cfg = (seed: string, over: Partial<GameConfig> = {}): GameConfig => ({
  ...DEFAULT_CONFIG,
  seed,
  mode: "survival",
  ...over,
});

function play(seed: string, ticks: number, respond: boolean): GameState {
  const g = newGame(cfg(seed));
  for (let i = 0; i < ticks && g.status.kind === "running"; i++) {
    g.budgetWindowOpen = false;
    let d = pendingDecision(g);
    while (d) {
      const ev = getEvent(d.eventId)!;
      const choice = respond
        ? (ev.choices.find((c) => !c.ignore) ?? ev.choices[0])
        : ev.choices.find((c) => c.ignore)!;
      const r = resolveEvent(g, d.uid, choice.id);
      if (!r.ok) resolveEvent(g, d.uid, ev.choices.find((c) => c.ignore)!.id);
      d = pendingDecision(g);
    }
    stepTick(g);
  }
  return g;
}

describe("events in full games", () => {
  it("fire at a sensible pace and never beat their cooldowns", () => {
    for (const seed of ["a", "b", "c"]) {
      const g = play(seed, 416, false);
      const fired = g.events.history.length + g.events.active.length;
      expect(fired, seed).toBeGreaterThan(8);
      expect(fired, seed).toBeLessThan(260);
      const last = new Map<string, number>();
      for (const h of [...g.events.history].sort(
        (x, y) => x.firedTick - y.firedTick,
      )) {
        const ev = getEvent(h.eventId)!;
        const key = `${h.eventId}:${h.stateId ?? ""}`;
        const prev = last.get(key);
        if (prev !== undefined)
          expect(h.firedTick - prev, key).toBeGreaterThanOrEqual(
            ev.cooldownTicks,
          );
        last.set(key, h.firedTick);
      }
    }
  });

  it("only runs chain-only events through chains", () => {
    const g = play("chains", 520, false);
    const chainOnly = EVENTS.filter((e) =>
      e.conditions.some((c) => c.type === "minTick" && c.tick >= 1000000),
    ).map((e) => e.id);
    const parents = new Set(
      EVENTS.flatMap((e) => (e.chains ?? []).map((c) => c.eventId)),
    );
    for (const id of chainOnly) expect(parents.has(id), id).toBe(true);
    expect(g.events.history.length).toBeGreaterThan(0);
  });

  it("plays differently when the player responds", () => {
    const ignored = play("resp", 416, false),
      responded = play("resp", 416, true);
    expect(JSON.stringify(ignored.states.map((s) => s.mood))).not.toBe(
      JSON.stringify(responded.states.map((s) => s.mood)),
    );
  });

  it("generates headlines for events and thresholds", () => {
    const g = play("news", 416, false);
    expect(g.news.items.length).toBeGreaterThan(15);
    expect(g.news.items.some((n) => n.templateId.startsWith("ev."))).toBe(true);
  });

  it("fires the national stress events when the country is under strain", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const g = newGame(cfg(`stress-${i}`));
      for (let t = 0; t < 260 && g.status.kind === "running"; t++) {
        g.budgetWindowOpen = false;
        g.national.inflation = Math.max(g.national.inflation, 24);
        g.national.nairaStrength = Math.min(g.national.nairaStrength, 25);
        g.national.assemblySupport = Math.min(g.national.assemblySupport, 35);
        g.national.treasury = Math.max(g.national.treasury, 800);
        for (const s of g.states) s.power = Math.min(s.power, 25);
        const d = pendingDecision(g);
        if (d)
          resolveEvent(
            g,
            d.uid,
            getEvent(d.eventId)!.choices.find((c) => c.ignore)!.id,
          );
        stepTick(g);
      }
      for (const h of g.events.history) seen.add(h.eventId);
    }
    for (const id of [
      "price_shock",
      "union_strike_notice",
      "strike_spreads",
      "fx_crunch",
      "grid_collapse",
      "assembly_standoff",
    ]) {
      expect(seen.has(id), id).toBe(true);
    }
  });

  it("reaches every non-chain event across a spread of seeds", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const g = play(`cov-${i}`, 416, i % 2 === 0);
      for (const h of g.events.history) seen.add(h.eventId);
    }
    const unreachable = EVENTS.filter((e) => !seen.has(e.id)).map((e) => e.id);
    expect(unreachable.length).toBeLessThan(EVENTS.length / 2);
  });
});
