import { create } from 'zustand';
import { DEFAULT_CONFIG, enactPolicy, newGame, setBudget, shouldAutoPause, stepTick } from '../engine';
import type { Action, Budget, EnactOptions, EnactResult, GameConfig, GameState } from '../engine';

export type Metric = 'mood' | 'security' | 'economy' | 'power' | 'health' | 'education' | 'infrastructure' | 'welfare';
export const METRICS: Metric[] = ['mood', 'security', 'economy', 'power', 'health', 'education', 'infrastructure', 'welfare'];

interface Store {
  game: GameState;
  rev: number;
  actions: Action[];
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
  confirmBudget: (budget: Budget) => void;
  enact: (policyId: string, opts?: EnactOptions) => EnactResult;
}

export const useGame = create<Store>((set, get) => ({
  game: newGame({ ...DEFAULT_CONFIG, seed: 'initial' }),
  rev: 0,
  actions: [],
  playing: false,
  speed: DEFAULT_CONFIG.speed,
  metric: 'mood',
  selected: null,
  newGame: (config = DEFAULT_CONFIG) =>
    set((s) => ({ game: newGame(config), rev: s.rev + 1, actions: [], playing: false, speed: config.speed, selected: null })),
  setPlaying: (playing) => set((s) => ({ playing: playing && !shouldAutoPause(s.game) })),
  setSpeed: (speed) => set({ speed }),
  setMetric: (metric) => set({ metric }),
  select: (selected) => set({ selected }),
  advance: () => {
    const { game } = get();
    stepTick(game);
    set((s) => ({ rev: s.rev + 1, playing: s.playing && !shouldAutoPause(game) }));
  },
  confirmBudget: (budget) => {
    const { game } = get();
    setBudget(game, budget);
    set((s) => ({ rev: s.rev + 1, actions: [...s.actions, { tick: game.tick, type: 'setBudget', budget }] }));
  },
  enact: (policyId, opts = {}) => {
    const { game } = get();
    const tick = game.tick;
    const result = enactPolicy(game, policyId, opts);
    set((s) => ({
      rev: s.rev + 1,
      actions: [...s.actions, { tick, type: 'enactPolicy', policyId, sweetener: opts.sweetener, zone: opts.zone }],
    }));
    return result;
  },
}));
