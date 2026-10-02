import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, Rng, SECTORS, TICKS_PER_QUARTER, TICKS_PER_YEAR, computeFunding, defaultBudget, leakage, newGame,
  replay, setBudget, stepTick, stateShares, checkEnd,
} from '../src/engine';
import type { Action, GameConfig, GameState } from '../src/engine';

const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({ ...DEFAULT_CONFIG, seed: 'test', ...over });
const run = (g: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    g.budgetWindowOpen = false;
    stepTick(g);
  }
};
const state = (g: GameState, id: string) => g.states.find((s) => s.id === id)!;

describe('rng', () => {
  it('is deterministic per seed and restorable from state', () => {
    const a = Rng.fromSeed('abc'), b = Rng.fromSeed('abc');
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    const c = new Rng(a.state);
    expect(c.next()).toBe(a.next());
    expect(Rng.fromSeed('abd').next()).not.toBe(Rng.fromSeed('abc').next());
  });
});

describe('seeding', () => {
  it('creates 37 regions with stats in range', () => {
    const g = newGame(cfg());
    expect(g.states).toHaveLength(37);
    for (const s of g.states) {
      for (const k of SECTORS) {
        expect(s[k]).toBeGreaterThanOrEqual(0);
        expect(s[k]).toBeLessThanOrEqual(100);
      }
    }
    expect(state(g, 'borno').security).toBeLessThan(state(g, 'lagos').security);
  });
});

describe('clock and budget window', () => {
  it('opens a budget window at each quarter start', () => {
    const g = newGame(cfg());
    expect(g.budgetWindowOpen).toBe(true);
    run(g, TICKS_PER_QUARTER - 1);
    expect(g.budgetWindowOpen).toBe(false);
    stepTick(g);
    expect(g.budgetWindowOpen).toBe(true);
  });
  it('rejects budgets that do not sum to 1', () => {
    const g = newGame(cfg());
    const b = defaultBudget();
    b.shares.security = 0.9;
    expect(() => setBudget(g, b)).toThrow();
  });
});

describe('funding split', () => {
  it('state shares sum to 1 for every allocation style', () => {
    const g = newGame(cfg());
    for (const allocation of [{ need: 1, population: 0, loyalty: 0 }, { need: 0, population: 1, loyalty: 0 }, { need: 0, population: 0, loyalty: 1 }]) {
      const sum = stateShares(g, 'health', allocation).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });
  it('by-need favours low stats, by-loyalty favours loyal governors', () => {
    const g = newGame(cfg());
    g.programmePerTick = 36;
    for (const s of g.states) s.corruption = 0;
    setBudget(g, { ...defaultBudget(), allocation: { need: 1, population: 0, loyalty: 0 } });
    const need = computeFunding(g);
    const poorest = [...g.states].sort((a, b) => a.health - b.health)[0];
    const richest = [...g.states].sort((a, b) => b.health - a.health)[0];
    expect(need[poorest.id].health).toBeGreaterThan(need[richest.id].health);

    setBudget(g, { ...defaultBudget(), allocation: { need: 0, population: 0, loyalty: 1 } });
    const loyal = computeFunding(g);
    const most = [...g.states].sort((a, b) => b.governorLoyalty - a.governorLoyalty)[0];
    const least = [...g.states].sort((a, b) => a.governorLoyalty - b.governorLoyalty)[0];
    expect(loyal[most.id].health).toBeGreaterThan(loyal[least.id].health);
  });
  it('leakage reduces what arrives and is capped at 50%', () => {
    const g = newGame(cfg());
    const s = g.states[0];
    s.corruption = 100;
    expect(leakage(s)).toBe(0.5);
    s.corruption = 0;
    expect(leakage(s)).toBe(0);
    g.programmePerTick = 36;
    const clean = computeFunding(g)[s.id].security;
    s.corruption = 80;
    expect(computeFunding(g)[s.id].security).toBeLessThan(clean);
  });
  it('total delivered equals programme minus leakage when affordable', () => {
    const g = newGame(cfg());
    g.programmePerTick = 36;
    const f = computeFunding(g);
    let delivered = 0;
    for (const s of g.states) for (const k of SECTORS) delivered += f[s.id][k];
    expect(delivered).toBeLessThanOrEqual(36);
    expect(delivered).toBeGreaterThan(36 * 0.5);
  });
  it('changing allocation shifts outcomes over a run', () => {
    const a = newGame(cfg()), b = newGame(cfg());
    setBudget(a, { ...defaultBudget(), allocation: { need: 1, population: 0, loyalty: 0 } });
    setBudget(b, { ...defaultBudget(), allocation: { need: 0, population: 0, loyalty: 1 } });
    const borno = (g: GameState) => state(g, 'borno');
    run(a, 104); run(b, 104);
    expect(borno(a).security).not.toBeCloseTo(borno(b).security, 1);
  });
});

describe('stat dynamics', () => {
  it('decays stats with no programme funding', () => {
    const g = newGame(cfg());
    const before = state(g, 'oyo').health;
    g.programmePerTick = 0;
    for (let i = 0; i < 26; i++) { g.programmePerTick = 0; g.budgetWindowOpen = false; stepTick(g); }
    expect(state(g, 'oyo').health).toBeLessThan(before);
  });
  it('good power lifts economy relative to bad power', () => {
    const hi = newGame(cfg()), lo = newGame(cfg());
    for (const g of [hi, lo]) { g.programmePerTick = 0; for (const s of g.states) s.economy = 50; }
    for (const s of hi.states) s.power = 90;
    for (const s of lo.states) s.power = 10;
    for (const g of [hi, lo]) { g.programmePerTick = 0; g.budgetWindowOpen = false; stepTick(g); }
    expect(state(hi, 'oyo').economy).toBeGreaterThan(state(lo, 'oyo').economy);
  });
  it('high inflation lowers mood', () => {
    const calm = newGame(cfg()), hot = newGame(cfg());
    hot.national.inflation = 60;
    run(calm, 1); run(hot, 1);
    expect(state(hot, 'oyo').mood).toBeLessThan(state(calm, 'oyo').mood);
  });
  it('keeps every value within bounds over a long run', () => {
    const g = newGame(cfg({ mode: 'survival' }));
    run(g, 400);
    for (const s of g.states) for (const v of [...SECTORS.map((k) => s[k]), s.mood, s.unrest, s.corruption, s.insurgencyRisk, s.governorLoyalty]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('determinism', () => {
  it('same seed and actions give identical runs', () => {
    const actions: Action[] = [{ tick: 13, type: 'setBudget', budget: { ...defaultBudget(), allocation: { need: 0.8, population: 0.1, loyalty: 0.1 } } }];
    const a = replay(cfg(), actions, 120), b = replay(cfg(), actions, 120);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(replay(cfg({ seed: 'other' }), actions, 120))).not.toBe(JSON.stringify(a));
  });
  it('runs 208 ticks in under one second', () => {
    const g = newGame(cfg());
    const t0 = performance.now();
    run(g, 208);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe('end checks', () => {
  const primed = (over: Partial<GameConfig> = {}) => newGame(cfg({ mode: 'survival', ...over }));
  it('coup after sustained low stability', () => {
    const g = primed();
    for (let i = 0; i < 12; i++) { g.national.stability = 5; checkEnd(g); }
    expect(g.status).toMatchObject({ kind: 'removed', reason: 'coup' });
  });
  it('a bigger security budget lowers the stability at which a coup happens', () => {
    const a = primed(), b = primed();
    setBudget(b, { ...defaultBudget(), shares: { ...defaultBudget().shares, security: 0.4, welfare: 0, economy: 0.02 } });
    a.national.stability = b.national.stability = 22;
    for (let i = 0; i < 12; i++) { checkEnd(a); checkEnd(b); }
    expect(a.status).toMatchObject({ kind: 'removed', reason: 'coup' });
    expect(b.status.kind).toBe('running');
  });
  it('impeachment needs low approval, assembly and high opposition together', () => {
    const g = primed();
    Object.assign(g.national, { approval: 20, assemblySupport: 20, opposition: 80 });
    for (let i = 0; i < 8; i++) checkEnd(g);
    expect(g.status).toMatchObject({ kind: 'removed', reason: 'impeachment' });
    const h = primed();
    Object.assign(h.national, { approval: 20, assemblySupport: 70, opposition: 80 });
    for (let i = 0; i < 20; i++) checkEnd(h);
    expect(h.status.kind).toBe('running');
  });
  it('collapse needs empty treasury and high unrest', () => {
    const g = primed();
    g.national.treasury = 0;
    for (const s of g.states) s.unrest = 80;
    for (let i = 0; i < 4; i++) checkEnd(g);
    expect(g.status).toMatchObject({ kind: 'removed', reason: 'collapse' });
  });
  it('term mode ends at the term boundary; survival does not', () => {
    const t = newGame(cfg({ termYears: 2 }));
    t.tick = 2 * TICKS_PER_YEAR;
    checkEnd(t);
    expect(t.status.kind).toBe('term_end');
    const s = primed({ termYears: 2 });
    s.tick = 2 * TICKS_PER_YEAR;
    checkEnd(s);
    expect(s.status.kind).toBe('running');
  });
  it('stops stepping once the game has ended', () => {
    const g = primed();
    g.status = { kind: 'removed', reason: 'coup', tick: 0 };
    stepTick(g);
    expect(g.tick).toBe(0);
  });
});

describe('architecture', () => {
  it('engine has no UI, React or DOM imports', () => {
    for (const f of readdirSync('src/engine')) {
      const src = readFileSync(`src/engine/${f}`, 'utf8');
      expect(src, f).not.toMatch(/from ['"](react|react-dom|zustand)/);
      expect(src, f).not.toMatch(/from ['"]\.\.\/(ui|store)\//);
      expect(src, f).not.toMatch(/\b(window|document|localStorage)\./);
    }
  });
});
