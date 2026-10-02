import { SECONDS_PER_TICK, TICKS_PER_QUARTER, TICKS_PER_YEAR } from './balance';
import type { GameConfig, GameState } from './state';

export function secondsPerTick(speed: GameConfig['speed']): number {
  return SECONDS_PER_TICK[speed];
}

export function gameDate(tick: number): { year: number; quarter: number; week: number } {
  return {
    year: Math.floor(tick / TICKS_PER_YEAR) + 1,
    quarter: Math.floor((tick % TICKS_PER_YEAR) / TICKS_PER_QUARTER) + 1,
    week: (tick % TICKS_PER_QUARTER) + 1,
  };
}

export function isQuarterStart(tick: number): boolean {
  return tick % TICKS_PER_QUARTER === 0;
}

export function shouldAutoPause(g: GameState): boolean {
  return g.status.kind !== 'running' || g.budgetWindowOpen;
}
