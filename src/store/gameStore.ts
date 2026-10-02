import { create } from 'zustand';
import { DEFAULT_CONFIG, enactPolicy, newGame, setBudget, shouldAutoPause, stepTick } from '../engine';
import { resolveEvent, resolveTermEnd } from '../engine';
import { buildSave } from '../persistence/saveFormat';
import type { SaveData } from '../persistence/saveFormat';
import { deleteSlot, saveToSlot } from '../persistence/db';
import type { Slot } from '../persistence/db';
import { useSettings } from './settingsStore';
import type { Action, Budget, EnactOptions, EnactResult, GameConfig, ElectionResult, GameState, ResolveResult } from '../engine';

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
  tone: 'dry' | 'wahala';
  openEventUid: number | null;
  election: ElectionResult | null;
  newGame: (config?: GameConfig) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: GameConfig['speed']) => void;
  setMetric: (m: Metric) => void;
  select: (id: string | null) => void;
  setTone: (t: 'dry' | 'wahala') => void;
  openEvent: (uid: number | null) => void;
  resolve: (uid: number, choiceId: string) => ResolveResult;
  endTerm: () => ElectionResult | null;
  dismissElection: () => void;
  currentSave: () => SaveData;
  loadSave: (data: SaveData) => void;
  saveTo: (slot: Slot) => Promise<void>;
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
  tone: DEFAULT_CONFIG.tone,
  openEventUid: null,
  election: null,
  newGame: (config = DEFAULT_CONFIG) =>
    set((s) => ({ game: newGame(config), rev: s.rev + 1, actions: [], playing: false, speed: config.speed, selected: null, tone: config.tone, election: null, openEventUid: null })),
  setPlaying: (playing) => set((s) => ({ playing: playing && !shouldAutoPause(s.game) })),
  setSpeed: (speed) => set({ speed }),
  setMetric: (metric) => set({ metric }),
  select: (selected) => set({ selected }),
  setTone: (tone) => set({ tone }),
  openEvent: (openEventUid) => set({ openEventUid }),
  endTerm: () => {
    const { game } = get();
    if (game.status.kind !== 'term_end') return null;
    const result = resolveTermEnd(game);
    set((s) => ({ rev: s.rev + 1, election: result, playing: false }));
    return result;
  },
  dismissElection: () => set({ election: null }),
  currentSave: () => {
    const { game, actions, tone, speed, metric } = get();
    return buildSave(game, actions, { tone, speed, metric });
  },
  loadSave: (data) =>
    set((s) => ({
      game: data.state,
      actions: data.actions,
      rev: s.rev + 1,
      playing: false,
      speed: data.ui.speed,
      tone: data.ui.tone,
      metric: data.ui.metric as Metric,
      selected: null,
      election: null,
      openEventUid: null,
    })),
  saveTo: async (slot) => {
    await saveToSlot(slot, get().currentSave());
  },
  resolve: (uid, choiceId) => {
    const { game } = get();
    const tick = game.tick;
    const result = resolveEvent(game, uid, choiceId);
    if (result.ok) {
      set((s) => ({
        rev: s.rev + 1,
        openEventUid: s.openEventUid === uid ? null : s.openEventUid,
        actions: [...s.actions, { tick, type: 'resolveEvent', uid, choiceId }],
      }));
    }
    return result;
  },
  advance: () => {
    const { game } = get();
    stepTick(game);
    set((s) => ({ rev: s.rev + 1, playing: s.playing && !shouldAutoPause(game) }));
    if (game.status.kind === 'removed' || game.status.kind === 'finished') void deleteSlot('auto').catch(() => undefined);
    else if (game.budgetWindowOpen && useSettings.getState().settings.autosave) void get().saveTo('auto').catch(() => undefined);
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
