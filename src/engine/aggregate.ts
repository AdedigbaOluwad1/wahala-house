import type { GameState, StateData } from './state';

export function weightedMean(g: GameState, f: (s: StateData) => number): number {
  let w = 0;
  let t = 0;
  for (const s of g.states) {
    w += f(s) * s.population;
    t += s.population;
  }
  return w / t;
}
