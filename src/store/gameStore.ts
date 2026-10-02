import { create } from 'zustand';
import { DEFAULT_CONFIG, newGame, setBudget, stepTick } from '../engine';
import type { GameConfig, GameState } from '../engine';
import { shouldAutoPause } from '../engine';

export type Metric = 'mood' | 'security' | 'economy' | 'power' | 'health' | 'education' | 'infrastructure' | 'welfare';
export const METRICS: Metric[] = ['mood', 'security', 'economy', 'power', 'health', 'education', 'infrastructure', 'welfare'];

interface Store {
  game: GameState;
  rev: number;
  playing: boolean;
  speed: GameConfig['speed'];
  metric: Metric;
  selected: string | null;
  newGame: (config?: GameConfig) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: GameConfig['speed']) => void;
  setMetric: (m: Metric) => void;
  select: (id: string | null) => void;
  advance: () => void;
  confirmBudget: () => void;
}

export const useGame = create<Store>((set, get) => ({
  game: newGame({ ...DEFAULT_CONFIG, seed: 'initial' }),
  rev: 0,
  playing: false,
  speed: DEFAULT_CONFIG.speed,
  metric: 'mood',
  selected: null,
  newGame: (config = DEFAULT_CONFIG) =>
    set((s) => ({ game: newGame(config), rev: s.rev + 1, playing: false, speed: config.speed, selected: null })),
  setPlaying: (playing) => set((s) => ({ playing: playing && !shouldAutoPause(s.game) })),
  setSpeed: (speed) => set({ speed }),
  setMetric: (metric) => set({ metric }),
  select: (selected) => set({ selected }),
  advance: () => {
    const { game } = get();
    stepTick(game);
    set((s) => ({ rev: s.rev + 1, playing: s.playing && !shouldAutoPause(game) }));
  },
  confirmBudget: () => {
    const { game } = get();
    setBudget(game, game.budget);
    set((s) => ({ rev: s.rev + 1 }));
  },
}));
