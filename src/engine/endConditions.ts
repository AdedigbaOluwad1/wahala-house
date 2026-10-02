import { COLLAPSE, COUP, DEFAULT_SHARES, IMPEACHMENT, TICKS_PER_YEAR } from './balance';
import type { GameState } from './state';

function forcesSatisfaction(g: GameState): number {
  return g.budget.shares.security / DEFAULT_SHARES.security;
}

export function coupThreshold(g: GameState): number {
  const crisis = g.national.crisisLoad * 0.1;
  const satisfaction = (forcesSatisfaction(g) - 1) * 5;
  return COUP.stability + crisis - satisfaction;
}

function avgUnrest(g: GameState): number {
  let w = 0, t = 0;
  for (const s of g.states) { w += s.unrest * s.population; t += s.population; }
  return w / t;
}

export function checkEnd(g: GameState): void {
  if (g.status.kind !== 'running') return;
  const n = g.national;
  const c = g.counters;

  c.coup = n.stability < coupThreshold(g) ? c.coup + 1 : 0;
  c.impeachment =
    n.approval < IMPEACHMENT.approval && n.assemblySupport < IMPEACHMENT.assembly && n.opposition > IMPEACHMENT.opposition
      ? c.impeachment + 1 : 0;
  c.collapse = n.treasury <= 0 && avgUnrest(g) >= COLLAPSE.unrest ? c.collapse + 1 : 0;

  if (c.coup >= COUP.ticks) g.status = { kind: 'removed', reason: 'coup', tick: g.tick };
  else if (c.impeachment >= IMPEACHMENT.ticks) g.status = { kind: 'removed', reason: 'impeachment', tick: g.tick };
  else if (c.collapse >= COLLAPSE.ticks) g.status = { kind: 'removed', reason: 'collapse', tick: g.tick };
  else if (g.config.mode === 'term' && g.tick >= g.config.termYears * TICKS_PER_YEAR) {
    g.status = { kind: 'term_end', tick: g.tick };
  }
}
