import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, Rng, buildLegacy, checkEnd, computeScore, conditionHolds, enactPolicy, newGame, outcomeOf, replay,
  resolveTermEnd, runElection, stepTick, termsRemaining,
} from '../src/engine';
import type { GameConfig, GameState } from '../src/engine';

const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({ ...DEFAULT_CONFIG, seed: 'end', ...over });
const BIG = new Set(['lagos', 'kano', 'rivers', 'kaduna', 'oyo', 'katsina', 'bauchi', 'jigawa', 'delta', 'ogun', 'niger', 'benue']);

function setMood(g: GameState, mood: number | ((id: string) => number), loyalty = 50) {
  for (const s of g.states) {
    s.mood = typeof mood === 'number' ? mood : mood(s.id);
    s.governorLoyalty = loyalty;
  }
  const avg = g.states.reduce((a, s) => a + s.mood, 0) / g.states.length;
  Object.assign(g.national, { approval: avg, stability: Math.max(30, avg), opposition: 100 - avg });
}

const toTermEnd = (g: GameState) => {
  g.tick = g.termEndTick;
  checkEnd(g);
};

describe('election model', () => {
  it('produces consistent vote shares and is deterministic per rng', () => {
    const g = newGame(cfg());
    setMood(g, 55);
    const a = runElection(g, new Rng(1)), b = runElection(g, new Rng(1));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.first.states).toHaveLength(37);
    const sum = a.first.nationalShares.player + a.first.nationalShares.uda + a.first.nationalShares.third;
    expect(sum).toBeCloseTo(1, 6);
    expect(a.first.statesRequired).toBe(24);
  });

  it('a content country re-elects and an unhappy one does not', () => {
    const happy = newGame(cfg()), sad = newGame(cfg());
    setMood(happy, 78, 70);
    setMood(sad, 30, 30);
    expect(runElection(happy, new Rng(2)).playerWon).toBe(true);
    expect(runElection(sad, new Rng(2)).playerWon).toBe(false);
  });

  it('forces a runoff when the winner misses the 25% spread, and a lead can still be lost', () => {
    let spreadFails = 0;
    let leadButLost = 0;
    for (let i = 0; i < 60; i++) {
      const g = newGame(cfg({ seed: `sp${i}` }));
      setMood(g, (id) => (BIG.has(id) ? 70 : 20));
      g.national.approval = 50;
      g.national.opposition = 40;
      const r = runElection(g, new Rng(i + 1));
      if (r.lostOnSpread) {
        spreadFails++;
        expect(r.runoffHeld).toBe(true);
        expect(r.runoff).toBeDefined();
        expect(r.winner).toBe(r.runoff!.leader);
        if (r.first.leader === 'player' && !r.playerWon) leadButLost++;
      } else {
        expect(r.runoffHeld).toBe(false);
        expect(r.winner).toBe(r.first.leader);
      }
    }
    expect(spreadFails).toBeGreaterThan(5);
    expect(leadButLost).toBeGreaterThan(0);
  });

  it('requires 25% in the FCT separately from the states', () => {
    const g = newGame(cfg());
    setMood(g, (id) => (id === 'fct' ? 0 : 90), 80);
    g.national.approval = 80;
    g.national.opposition = 20;
    for (const s of g.states) if (s.id === 'fct') s.governorLoyalty = 0;
    const r = runElection(g, new Rng(3));
    expect(r.first.statesMeeting.player).toBe(36);
    expect(r.first.fctMet.player).toBe(false);
    expect(r.first.spreadMet.player).toBe(false);
    expect(r.runoffHeld).toBe(true);
  });
});

describe('terms and modes', () => {
  it('a won election starts a second term, then the term limit ends the game', () => {
    const g = newGame(cfg({ termsAllowed: 2, termYears: 2 }));
    setMood(g, 80, 80);
    toTermEnd(g);
    expect(g.status.kind).toBe('term_end');
    const r = resolveTermEnd(g);
    expect(r?.playerWon).toBe(true);
    expect(g.status).toEqual({ kind: 'running' });
    expect(g.term).toBe(2);
    expect(g.termEndTick).toBe(g.tick + 104);
    toTermEnd(g);
    expect(resolveTermEnd(g)).toBeNull();
    expect(g.status).toMatchObject({ kind: 'finished', outcome: 'term_limit' });
  });

  it('losing the election ends the game', () => {
    const g = newGame(cfg({ termYears: 2 }));
    setMood(g, 25, 20);
    toTermEnd(g);
    const r = resolveTermEnd(g);
    expect(r?.playerWon).toBe(false);
    expect(g.status).toMatchObject({ kind: 'finished', outcome: 'voted_out' });
  });

  it('a single allowed term finishes without an election', () => {
    const g = newGame(cfg({ termsAllowed: 1, termYears: 2 }));
    toTermEnd(g);
    expect(resolveTermEnd(g)).toBeNull();
    expect(g.elections).toHaveLength(0);
    expect(g.status).toMatchObject({ kind: 'finished', outcome: 'term_limit' });
  });

  it('unlimited terms always allow another run', () => {
    const g = newGame(cfg({ termsAllowed: 'unlimited' }));
    g.term = 9;
    expect(termsRemaining(g)).toBe(true);
  });

  it('survival mode has no scheduled election', () => {
    const g = newGame(cfg({ mode: 'survival', termYears: 2 }));
    g.tick = 500;
    checkEnd(g);
    expect(g.status.kind).toBe('running');
  });

  it('replay resolves elections automatically', () => {
    const g = replay(cfg({ termYears: 2, termsAllowed: 2, seed: 'auto' }), [], 400);
    expect(g.elections.length + (g.status.kind === 'removed' ? 1 : 0)).toBeGreaterThan(0);
    expect(g.status.kind).not.toBe('term_end');
  });

  it('the opposition surge event only happens in survival mode', () => {
    const survival = newGame(cfg({ mode: 'survival' })), term = newGame(cfg({ mode: 'term' }));
    for (const g of [survival, term]) g.tick = 200;
    const cond = { type: 'mode', mode: 'survival' } as const;
    expect(conditionHolds(survival, cond)).toBe(true);
    expect(conditionHolds(term, cond)).toBe(false);
  });
});

describe('legacy report', () => {
  const play = (over: Partial<GameConfig> = {}, ticks = 120) => {
    const g = newGame(cfg(over));
    for (let i = 0; i < ticks && g.status.kind === 'running'; i++) {
      g.budgetWindowOpen = false;
      g.events.active = g.events.active.filter((a) => a.severity !== 3);
      stepTick(g);
    }
    return g;
  };

  it('maps end statuses to outcomes', () => {
    expect(outcomeOf({ kind: 'removed', reason: 'coup', tick: 1 })).toBe('coup');
    expect(outcomeOf({ kind: 'finished', outcome: 'voted_out', tick: 1 })).toBe('voted_out');
    expect(outcomeOf({ kind: 'running' })).toBe('ongoing');
  });

  it('summarises a run', () => {
    const g = play({ mode: 'survival' });
    g.national.treasury = 5000;
    g.national.assemblySupport = 100;
    enactPolicy(g, 'remove_fuel_subsidy');
    for (let i = 0; i < 20; i++) { g.budgetWindowOpen = false; stepTick(g); }
    const l = buildLegacy(g);
    expect(l.ticks).toBe(g.stats.ticks);
    expect(l.best[0].mood).toBeGreaterThanOrEqual(l.best[2].mood);
    expect(l.worst[0].mood).toBeLessThanOrEqual(l.worst[2].mood);
    expect(l.best[0].mood).toBeGreaterThanOrEqual(l.worst[0].mood);
    expect(l.changes).toHaveLength(8);
    for (const c of l.traded) expect(c.delta).toBeLessThan(0);
    expect(l.tradeoff).toMatchObject({ kind: 'policy', policyId: 'remove_fuel_subsidy' });
    expect(l.timeline.some((t) => t.type === 'policy')).toBe(true);
    expect(l.score).toBe(computeScore(g));
  });

  it('scores longer, better-liked terms higher', () => {
    const short = play({ mode: 'survival' }, 60), long = play({ mode: 'survival' }, 160);
    expect(computeScore(long)).toBeGreaterThan(computeScore(short));
  });

  it('adds bonuses for won elections and completed terms', () => {
    const g = newGame(cfg({ termsAllowed: 2, termYears: 2 }));
    g.stats.ticks = 100;
    g.stats.approvalSum = 5000;
    g.stats.stabilitySum = 5000;
    const base = computeScore(g);
    setMood(g, 80, 80);
    toTermEnd(g);
    resolveTermEnd(g);
    expect(computeScore(g)).toBe(base + 500);
  });

  it('falls back to a budget trade-off when no policy was enacted', () => {
    const g = newGame(cfg());
    g.budget.shares = { ...g.budget.shares, security: 0.4, welfare: 0.01, economy: 0.09, health: 0.1 };
    const l = buildLegacy(g);
    expect(l.tradeoff).toMatchObject({ kind: 'budget', highSector: 'security', lowSector: 'welfare' });
  });
});
