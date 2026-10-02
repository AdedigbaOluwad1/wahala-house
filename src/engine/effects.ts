import type { Effect, GameState, StateData } from './state';

const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function applyEffect(g: GameState, effect: Effect): void {
  if (effect.kind === 'national') {
    const n = g.national;
    if (effect.meter === 'treasury') n.treasury = Math.max(0, n.treasury + effect.delta);
    else if (effect.meter === 'inflation') n.inflation = Math.max(0, n.inflation + effect.delta);
    else n[effect.meter] = clamp(n[effect.meter] + effect.delta);
    return;
  }
  const targets: StateData[] = effect.stateId === 'all' ? g.states : g.states.filter((s) => s.id === effect.stateId);
  for (const s of targets) {
    if (effect.target === 'mood') s.eventMood += effect.delta;
    else s[effect.target] = clamp(s[effect.target] + effect.delta);
  }
}

export function applyScheduled(g: GameState): void {
  const due = g.scheduled.filter((e) => e.applyAtTick <= g.tick);
  if (due.length === 0) return;
  g.scheduled = g.scheduled.filter((e) => e.applyAtTick > g.tick);
  for (const e of due) applyEffect(g, e.effect);
}
