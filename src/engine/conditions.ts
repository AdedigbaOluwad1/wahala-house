import { weightedMean } from './aggregate';
import { isActive } from './policies';
import type { GameState, StateData, StatKey, Trait, Zone } from './state';

export type StatField = StatKey | 'mood' | 'unrest' | 'corruption' | 'insurgencyRisk' | 'governorLoyalty';
export type NationalField =
  | 'treasury' | 'debt' | 'inflation' | 'nairaStrength' | 'oilPriceIndex'
  | 'approval' | 'stability' | 'assemblySupport' | 'opposition' | 'crisisLoad';
export type Op = '<' | '>';

export type Condition =
  | { type: 'stat'; stat: StatField; op: Op; value: number }
  | { type: 'avg'; stat: StatField; op: Op; value: number; forTicks?: number }
  | { type: 'national'; field: NationalField; op: Op; value: number; forTicks?: number }
  | { type: 'trait'; trait: Trait }
  | { type: 'zone'; zone: Zone }
  | { type: 'state'; id: string }
  | { type: 'policy'; policyId: string; active: boolean }
  | { type: 'quarter'; quarters: number[] }
  | { type: 'minTick'; tick: number }
  | { type: 'mode'; mode: 'term' | 'survival' };


interface HasConditions {
  conditions?: Condition[];
}

function fieldValue(s: StateData, stat: StatField): number {
  return s[stat];
}

function compare(a: number, op: Op, b: number): boolean {
  return op === '<' ? a < b : a > b;
}

export function streakKey(c: Condition): string {
  return JSON.stringify(c);
}

function holdsNow(g: GameState, c: Condition, s?: StateData): boolean {
  switch (c.type) {
    case 'stat': return s ? compare(fieldValue(s, c.stat), c.op, c.value) : false;
    case 'avg': return compare(weightedMean(g, (x) => fieldValue(x, c.stat)), c.op, c.value);
    case 'national': return compare(g.national[c.field], c.op, c.value);
    case 'trait': return s ? s.traits.includes(c.trait) : false;
    case 'zone': return s ? s.zone === c.zone : false;
    case 'state': return s ? s.id === c.id : false;
    case 'policy': return isActive(g, c.policyId) === c.active;
    case 'quarter': return c.quarters.includes(Math.floor((g.tick % 52) / 13) + 1);
    case 'minTick': return g.tick >= c.tick;
    case 'mode': return g.config.mode === c.mode;
  }
}

export function conditionHolds(g: GameState, c: Condition, s?: StateData): boolean {
  if ((c.type === 'avg' || c.type === 'national') && c.forTicks) {
    return (g.events.streaks[streakKey(c)] ?? 0) >= c.forTicks;
  }
  return holdsNow(g, c, s);
}

export function updateStreaks(g: GameState, items: HasConditions[]): void {
  for (const item of items) {
    for (const c of item.conditions ?? []) {
      if ((c.type === 'avg' || c.type === 'national') && c.forTicks) {
        const key = streakKey(c);
        g.events.streaks[key] = holdsNow(g, c) ? (g.events.streaks[key] ?? 0) + 1 : 0;
      }
    }
  }
}
