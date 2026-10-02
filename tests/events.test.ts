import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, Rng, briefingFor, checkThresholds, conditionHolds, enactPolicy, fireEvent, newGame, pushNews,
  quarterBriefing, renderNews, resolveEvent, rollAmbient, rollEvents, shouldAutoPause, stepTick,
} from '../src/engine';
import type { Condition, GameConfig, GameEvent, GameState, NewsTemplate } from '../src/engine';

const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({ ...DEFAULT_CONFIG, seed: 'ev', mode: 'survival', ...over });
const state = (g: GameState, id: string) => g.states.find((s) => s.id === id)!;
const tickOnly = (g: GameState) => {
  g.budgetWindowOpen = false;
  g.tick++;
};

const grid: GameEvent = {
  id: 'grid', title: 'Grid', body: 'x', tags: ['power'], scope: 'national', conditions: [{ type: 'avg', stat: 'power', op: '<', value: 35, forTicks: 3 }],
  baseProbability: 0.05, cooldownTicks: 20, severity: 3,
  choices: [
    { id: 'repair', label: 'Repair', cost: 80, effects: [{ kind: 'stat', target: 'power', scope: 'all', delta: 6 }] },
    { id: 'ignore', label: 'Ignore', ignore: true, effects: [{ kind: 'stat', target: 'mood', scope: 'all', delta: -4 }] },
  ],
  chains: [{ eventId: 'fallout', delayTicks: 4, ifChoice: 'ignore' }],
};
const fallout: GameEvent = {
  id: 'fallout', title: 'Fallout', body: 'x', tags: ['social'], scope: 'national', conditions: [{ type: 'minTick', tick: 100000 }],
  baseProbability: 0.01, cooldownTicks: 20, severity: 1,
  choices: [{ id: 'ignore', label: 'Ignore', ignore: true, effects: [{ kind: 'national', meter: 'stability', delta: -3 }] }],
};
const flood: GameEvent = {
  id: 'flood', title: 'Flood', body: 'x', tags: ['flood'], scope: 'state', conditions: [{ type: 'trait', trait: 'riverine' }],
  baseProbability: 1, cooldownTicks: 10, severity: 2,
  choices: [
    { id: 'relief', label: 'Relief', cost: 30, effects: [{ kind: 'stat', target: 'health', scope: '$state', delta: 5 }] },
    { id: 'ignore', label: 'Ignore', ignore: true, effects: [{ kind: 'stat', target: 'health', scope: '$state', delta: -8 }] },
  ],
};
const lowPower = (g: GameState) => {
  for (const s of g.states) s.power = 10;
};

describe('conditions', () => {
  it('evaluates stat, national, trait, zone, policy and quarter conditions', () => {
    const g = newGame(cfg());
    const kano = state(g, 'kano');
    const check = (c: Condition, s = kano) => conditionHolds(g, c, s);
    expect(check({ type: 'stat', stat: 'economy', op: '>', value: 0 })).toBe(true);
    expect(check({ type: 'stat', stat: 'economy', op: '<', value: 0 })).toBe(false);
    expect(check({ type: 'trait', trait: 'commercial_hub' })).toBe(true);
    expect(check({ type: 'trait', trait: 'port' })).toBe(false);
    expect(check({ type: 'zone', zone: 'NW' })).toBe(true);
    expect(check({ type: 'national', field: 'inflation', op: '>', value: 10 })).toBe(true);
    expect(check({ type: 'policy', policyId: 'raise_vat', active: false })).toBe(true);
    expect(check({ type: 'quarter', quarters: [1] })).toBe(true);
    expect(check({ type: 'quarter', quarters: [2, 3, 4] })).toBe(false);
    expect(conditionHolds(g, { type: 'stat', stat: 'economy', op: '>', value: 0 })).toBe(false);
  });
});

describe('event roll', () => {
  it('does not fire while its conditions fail, and fires once a sustained condition has held long enough', () => {
    const g = newGame(cfg());
    const rng = new Rng(1);
    for (let i = 0; i < 60; i++) { tickOnly(g); rollEvents(g, rng, [grid]); }
    expect(g.events.active).toHaveLength(0);
    lowPower(g);
    const start = g.tick;
    let firedAt = -1;
    for (let i = 0; i < 400 && firedAt < 0; i++) {
      tickOnly(g);
      rollEvents(g, rng, [grid]);
      if (g.events.active.length > 0) firedAt = g.tick;
    }
    expect(firedAt).toBeGreaterThanOrEqual(start + 3);
  });

  it('respects cooldowns', () => {
    const g = newGame(cfg());
    lowPower(g);
    const certain = { ...grid, baseProbability: 1, severity: 1 as const, choices: [grid.choices[1]], chains: [] };
    const rng = new Rng(2);
    let fires = 0;
    for (let i = 0; i < 200; i++) {
      tickOnly(g);
      const before = g.events.history.length;
      rollEvents(g, rng, [certain]);
      fires += g.events.history.length - before;
    }
    expect(fires).toBeLessThanOrEqual(Math.ceil(200 / 20));
    expect(fires).toBeGreaterThan(5);
  });

  it('only fires state events in qualifying states', () => {
    const g = newGame(cfg());
    const rng = new Rng(3);
    for (let i = 0; i < 30; i++) { tickOnly(g); rollEvents(g, rng, [flood]); }
    const riverine = new Set(g.states.filter((s) => s.traits.includes('riverine')).map((s) => s.id));
    const seen = [...g.events.active.map((a) => a.stateId), ...g.events.history.map((h) => h.stateId)];
    expect(seen.length).toBeGreaterThan(0);
    for (const id of seen) expect(riverine.has(id!)).toBe(true);
  });
});

describe('resolving events', () => {
  it('severity 3 pauses the game until resolved', () => {
    const g = newGame(cfg());
    g.budgetWindowOpen = false;
    const a = fireEvent(g, grid, undefined, [grid, fallout]);
    expect(shouldAutoPause(g)).toBe(true);
    expect(resolveEvent(g, a.uid, 'ignore', false, [grid, fallout])).toEqual({ ok: true });
    expect(shouldAutoPause(g)).toBe(false);
  });

  it('charges the cost and applies effects only where scoped', () => {
    const g = newGame(cfg());
    g.national.treasury = 500;
    const a = fireEvent(g, flood, 'bayelsa', [flood]);
    const bayelsa = state(g, 'bayelsa').health, kano = state(g, 'kano').health;
    expect(resolveEvent(g, a.uid, 'relief', false, [flood])).toEqual({ ok: true });
    expect(g.national.treasury).toBe(470);
    expect(state(g, 'bayelsa').health).toBeCloseTo(bayelsa + 5);
    expect(state(g, 'kano').health).toBe(kano);
  });

  it('refuses unaffordable or unknown choices', () => {
    const g = newGame(cfg());
    g.national.treasury = 10;
    const a = fireEvent(g, flood, 'bayelsa', [flood]);
    expect(resolveEvent(g, a.uid, 'relief', false, [flood])).toEqual({ ok: false, reason: 'insufficient_funds' });
    expect(resolveEvent(g, a.uid, 'nope', false, [flood])).toEqual({ ok: false, reason: 'unknown_choice' });
    expect(resolveEvent(g, 999, 'ignore', false, [flood])).toEqual({ ok: false, reason: 'unknown_event' });
    expect(g.events.active).toHaveLength(1);
  });

  it('ignoring and responding give different outcomes', () => {
    const a = newGame(cfg()), b = newGame(cfg());
    const ea = fireEvent(a, flood, 'bayelsa', [flood]), eb = fireEvent(b, flood, 'bayelsa', [flood]);
    a.national.treasury = b.national.treasury = 500;
    resolveEvent(a, ea.uid, 'relief', false, [flood]);
    resolveEvent(b, eb.uid, 'ignore', false, [flood]);
    expect(state(a, 'bayelsa').health).toBeGreaterThan(state(b, 'bayelsa').health);
  });

  it('severity 1 events resolve immediately with their automatic effects', () => {
    const g = newGame(cfg());
    const stability = g.national.stability;
    fireEvent(g, fallout, undefined, [fallout]);
    expect(g.events.active).toHaveLength(0);
    expect(g.national.stability).toBe(stability - 3);
    expect(g.events.history[0]).toMatchObject({ eventId: 'fallout', auto: true });
  });

  it('auto-ignores optional events after their window', () => {
    const g = newGame(cfg());
    fireEvent(g, flood, 'bayelsa', [flood]);
    const before = state(g, 'bayelsa').health;
    for (let i = 0; i < 9; i++) { tickOnly(g); rollEvents(g, new Rng(9), [{ ...flood, baseProbability: 1e-9 }]); }
    expect(g.events.active).toHaveLength(0);
    expect(state(g, 'bayelsa').health).toBeLessThan(before);
    expect(g.events.history[0].auto).toBe(true);
  });
});

describe('chains', () => {
  it('ignoring spawns the follow-up after its delay; responding does not', () => {
    const ignored = newGame(cfg()), responded = newGame(cfg());
    responded.national.treasury = 500;
    const events = [grid, fallout];
    const a = fireEvent(ignored, grid, undefined, events), b = fireEvent(responded, grid, undefined, events);
    resolveEvent(ignored, a.uid, 'ignore', false, events);
    resolveEvent(responded, b.uid, 'repair', false, events);
    expect(ignored.events.pendingChains).toHaveLength(1);
    expect(responded.events.pendingChains).toHaveLength(0);
    for (let i = 0; i < 5; i++) { tickOnly(ignored); rollEvents(ignored, new Rng(5), events); }
    expect(ignored.events.history.some((h) => h.eventId === 'fallout')).toBe(true);
    expect(ignored.events.pendingChains).toHaveLength(0);
  });
});

describe('news', () => {
  it('renders the same item in both tones and respects the toggle', () => {
    const g = newGame(cfg());
    pushNews(g, 'policy_enacted', { policy: 'Raise VAT' });
    const item = g.news.items[0];
    const dry = renderNews(item, 'dry'), wahala = renderNews(item, 'wahala');
    expect(dry).toContain('Raise VAT');
    expect(wahala).toContain('Raise VAT');
    expect(wahala).not.toBe(dry);
  });

  it('ignores unknown templates', () => {
    const g = newGame(cfg());
    pushNews(g, 'does.not.exist');
    expect(g.news.items).toHaveLength(0);
  });

  it('threshold news fires once per crossing', () => {
    const g = newGame(cfg());
    g.national.approval = 30;
    checkThresholds(g);
    checkThresholds(g);
    expect(g.news.items.filter((n) => n.templateId === 'threshold.approval_low')).toHaveLength(1);
    g.national.approval = 60;
    checkThresholds(g);
    g.national.approval = 30;
    checkThresholds(g);
    expect(g.news.items.filter((n) => n.templateId === 'threshold.approval_low')).toHaveLength(2);
  });

  it('policy enactment and failed votes produce headlines', () => {
    const g = newGame(cfg());
    g.national.treasury = 5000;
    g.national.assemblySupport = 100;
    enactPolicy(g, 'civil_service_pay_rise');
    expect(g.news.items.some((n) => n.templateId === 'policy_enacted')).toBe(true);
    const h = newGame(cfg());
    h.national.assemblySupport = 5;
    enactPolicy(h, 'raise_vat');
    expect(h.news.items.some((n) => n.templateId === 'policy_vote_failed')).toBe(true);
  });

  it('ambient headlines respect conditions and cooldowns', () => {
    const pool: NewsTemplate[] = [
      { id: 'amb.high', dry: ['a', 'b'], wahala: ['a', 'b'], conditions: [{ type: 'national', field: 'inflation', op: '>', value: 90 }] },
      { id: 'amb.any', dry: ['a', 'b'], wahala: ['a', 'b'] },
    ];
    const g = newGame(cfg());
    const rng = new Rng(4);
    for (let i = 0; i < 30; i++) { tickOnly(g); rollAmbient(g, rng, pool); }
    const ids = new Set(g.news.items.map((n) => n.templateId));
    expect(ids.has('amb.high')).toBe(false);
  });
});

describe('advisors', () => {
  it('give conditional briefings that can disagree', () => {
    const g = newGame(cfg());
    g.national.treasury = 50;
    for (const s of g.states) s.security = 20;
    expect(briefingFor(g, 'finance')).toMatch(/treasury/i);
    expect(briefingFor(g, 'security')).toMatch(/security/i);
    expect(quarterBriefing(g)).toHaveLength(4);
  });
});

describe('integration with the tick pipeline', () => {
  it('runs long games deterministically with events and news enabled', () => {
    const run = () => {
      const g = newGame(cfg({ seed: 'integration' }));
      for (let i = 0; i < 300 && g.status.kind === 'running'; i++) {
        g.budgetWindowOpen = false;
        for (const a of [...g.events.active]) resolveEvent(g, a.uid, 'ignore', true);
        stepTick(g);
      }
      return JSON.stringify(g);
    };
    expect(run()).toBe(run());
  });
});
