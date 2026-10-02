import { DEFAULT_ALLOCATION, SECTORS, enactPolicy, getEvent, getPolicy, resolveEvent, setBudget } from '../src/engine';
import type { Budget, GameState, Sector } from '../src/engine';
import { weightedMean } from '../src/engine/aggregate';

export interface Bot {
  name: string;
  act(g: GameState): void;
}

function normalise(raw: Record<Sector, number>): Record<Sector, number> {
  const total = SECTORS.reduce((a, k) => a + raw[k], 0);
  const out = {} as Record<Sector, number>;
  let used = 0;
  SECTORS.forEach((k, i) => {
    out[k] = i === SECTORS.length - 1 ? 1 - used : Math.round((raw[k] / total) * 1000) / 1000;
    used += out[k];
  });
  return out;
}

function budgetOf(shares: Record<Sector, number>, allocation = DEFAULT_ALLOCATION): Budget {
  return { shares: normalise(shares), allocation: { ...allocation } };
}

function resolveAll(g: GameState, pick: (g: GameState, eventId: string) => string | undefined): void {
  for (const a of [...g.events.active]) {
    const ev = getEvent(a.eventId);
    if (!ev) continue;
    const choice = pick(g, a.eventId) ?? ev.choices.find((c) => c.ignore)?.id ?? ev.choices[0].id;
    const res = resolveEvent(g, a.uid, choice);
    if (!res.ok) resolveEvent(g, a.uid, ev.choices.find((c) => !c.cost)?.id ?? ev.choices[0].id);
  }
}

function cheapestUseful(g: GameState, eventId: string, budgetCap: number): string | undefined {
  const ev = getEvent(eventId);
  if (!ev) return undefined;
  const affordable = ev.choices.filter((c) => !c.ignore && (c.cost ?? 0) <= Math.min(budgetCap, g.national.treasury - 150));
  if (affordable.length === 0) return undefined;
  return affordable.sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0].id;
}

function weakest(g: GameState): Sector[] {
  const score = (k: Sector) => weightedMean(g, (s) => s[k]);
  return [...SECTORS].sort((a, b) => score(a) - score(b));
}

export const idle: Bot = {
  name: 'idle',
  act(g) {
    resolveAll(g, () => undefined);
  },
};

export const balanced: Bot = {
  name: 'balanced',
  act(g) {
    resolveAll(g, (s, id) => cheapestUseful(s, id, 120));
    if (g.budgetWindowOpen) {
      const low = weakest(g);
      const shares = { security: 0.22, economy: 0.17, health: 0.15, power: 0.12, infrastructure: 0.14, education: 0.08, welfare: 0.12 };
      shares[low[0]] += 0.05;
      shares[low[1]] += 0.03;
      shares[low[SECTORS.length - 1]] -= 0.04;
      shares[low[SECTORS.length - 2]] -= 0.04;
      setBudget(g, budgetOf(shares, { need: 0.6, population: 0.35, loyalty: 0.05 }));
    }
    if (g.tick % 13 === 1) {
      const plan = ['anticorruption_drive', 'power_reform', 'refinery_refurbishment', 'recruit_police'];
      for (const id of plan) {
        const policy = getPolicy(id);
        if (policy && g.national.treasury > policy.cost + 300) enactPolicy(g, id, { sweetener: 25 });
      }
    }
  },
};

export const militarist: Bot = {
  name: 'militarist',
  act(g) {
    resolveAll(g, (s, id) => cheapestUseful(s, id, 80));
    if (g.budgetWindowOpen) {
      setBudget(g, budgetOf({ security: 0.55, health: 0.05, education: 0.05, infrastructure: 0.1, power: 0.1, economy: 0.1, welfare: 0.05 }));
    }
    if (g.tick % 13 === 1) {
      enactPolicy(g, 'military_surge', { sweetener: 20 });
      enactPolicy(g, 'recruit_police', { sweetener: 20 });
    }
  },
};

export const austerity: Bot = {
  name: 'austerity',
  act(g) {
    resolveAll(g, () => undefined);
    if (g.budgetWindowOpen) {
      setBudget(g, budgetOf({ security: 0.3, health: 0.03, education: 0.03, infrastructure: 0.15, power: 0.15, economy: 0.3, welfare: 0.04 }));
    }
    if (g.tick % 13 === 1) {
      enactPolicy(g, 'remove_fuel_subsidy', { sweetener: 30 });
      enactPolicy(g, 'raise_vat', { sweetener: 30 });
    }
  },
};

export const populist: Bot = {
  name: 'populist',
  act(g) {
    resolveAll(g, (s, id) => cheapestUseful(s, id, 60));
    if (g.budgetWindowOpen) {
      setBudget(
        g,
        budgetOf(
          { security: 0.08, health: 0.2, education: 0.15, infrastructure: 0.07, power: 0.05, economy: 0.1, welfare: 0.35 },
          { need: 0.1, population: 0.4, loyalty: 0.5 },
        ),
      );
    }
    if (g.tick % 13 === 1) {
      enactPolicy(g, 'cash_transfer', { sweetener: 20 });
      enactPolicy(g, 'civil_service_pay_rise', { sweetener: 20 });
    }
  },
};

export const BOTS: Bot[] = [idle, balanced, militarist, austerity, populist];
