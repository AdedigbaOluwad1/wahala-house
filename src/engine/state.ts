import { DIFFICULTY, DEFAULT_ALLOCATION, DEFAULT_SHARES, TICKS_PER_YEAR } from './balance';
import type { ElectionResult } from './election';
import { emptyEventsState } from './events';
import type { EventsState } from './events';
import { emptyNewsState } from './news';
import type { NewsState } from './news';
import { Rng } from './rng';
import {
  GOVERNOR_FIRST_NAMES, GOVERNOR_LAST_NAMES, GOVERNOR_TITLES, STATE_OVERRIDES, STATE_ROWS,
  ZONE_BASE_STATS, hazardBase,
} from '../content/states';

export type Zone = 'NC' | 'NE' | 'NW' | 'SE' | 'SS' | 'SW';
export type Trait =
  | 'oil' | 'agriculture' | 'commercial_hub' | 'urban_dense' | 'border'
  | 'conflict_zone' | 'riverine' | 'flood_prone' | 'mining' | 'port';
export type Difficulty = 'easy' | 'realistic' | 'brutal';

export const SECTORS = ['security', 'health', 'education', 'infrastructure', 'power', 'economy', 'welfare'] as const;
export type Sector = (typeof SECTORS)[number];
export type StatKey = Sector;
export type ModifierTarget = StatKey | 'mood';

export interface StatModifier {
  target: ModifierTarget;
  delta: number;
  ticksLeft: number;
}

export interface StateData {
  id: string;
  name: string;
  zone: Zone;
  population: number;
  areaKm2: number;
  revenueBase: number;
  traits: Trait[];
  governor: string;
  economy: number; security: number; health: number; education: number;
  infrastructure: number; power: number; welfare: number; mood: number;
  unrest: number; corruption: number; insurgencyRisk: number; governorLoyalty: number;
  eventMood: number;
  modifiers: StatModifier[];
}

export interface GameConfig {
  mode: 'term' | 'survival';
  termYears: 2 | 4 | 6;
  termsAllowed: 1 | 2 | 'unlimited';
  difficulty: Difficulty;
  speed: 'slow' | 'normal' | 'fast';
  tone: 'dry' | 'wahala';
  language: 'en' | 'en-pcm';
  seed?: string;
}

export const DEFAULT_CONFIG: GameConfig = {
  mode: 'term', termYears: 4, termsAllowed: 2, difficulty: 'realistic',
  speed: 'normal', tone: 'wahala', language: 'en-pcm',
};

export interface Budget {
  shares: Record<Sector, number>;
  allocation: { need: number; population: number; loyalty: number };
}

export interface National {
  treasury: number;
  debt: number;
  inflation: number;
  nairaStrength: number;
  oilPriceIndex: number;
  approval: number;
  stability: number;
  assemblySupport: number;
  opposition: number;
  revenue: number;
  spending: number;
  crisisLoad: number;
}

export type StateTarget = StatKey | 'mood' | 'unrest' | 'corruption' | 'insurgencyRisk' | 'governorLoyalty';
export type NationalMeter = 'treasury' | 'inflation' | 'nairaStrength' | 'approval' | 'stability' | 'assemblySupport' | 'opposition' | 'crisisLoad';

export type Effect =
  | { kind: 'stat'; target: StateTarget; scope: string; delta: number }
  | { kind: 'national'; meter: NationalMeter; delta: number }
  | { kind: 'ongoing'; target: StateTarget | 'revenue' | 'inflation'; scope?: string; perTick: number; ticks: number };

export interface ScheduledEffect {
  applyAtTick: number;
  effect: Effect;
  policyId?: string;
  eventId?: string;
  phase?: 'main' | 'side';
  note?: string;
}

export interface OngoingEffect {
  target: StateTarget | 'revenue' | 'inflation';
  scope: string;
  perTick: number;
  until: number;
}

export interface ActivePolicy {
  policyId: string;
  enactedTick: number;
  endsTick?: number;
}

export interface LandedEffect {
  tick: number;
  policyId: string;
  phase: 'main' | 'side';
  note?: string;
}

export type EndStatus =
  | { kind: 'running' }
  | { kind: 'removed'; reason: 'coup' | 'impeachment' | 'collapse'; tick: number }
  | { kind: 'term_end'; tick: number }
  | { kind: 'finished'; outcome: 'term_limit' | 'voted_out'; tick: number };

export interface TimelineEntry {
  tick: number;
  type: 'policy' | 'policy_failed' | 'event' | 'election' | 'ended';
  refId?: string;
  choiceId?: string;
  stateId?: string;
  ignored?: boolean;
  won?: boolean;
}

export interface RunStats {
  ticks: number;
  approvalSum: number;
  stabilitySum: number;
  peakInflation: number;
  minTreasury: number;
}

export type StartStats = Record<StatKey | 'mood', number>;

export interface Counters {
  coup: number;
  impeachment: number;
  collapse: number;
}

export interface GameState {
  version: 1;
  config: GameConfig;
  seed: string;
  rngState: number;
  tick: number;
  states: StateData[];
  national: National;
  budget: Budget;
  programmePerTick: number;
  budgetWindowOpen: boolean;
  scheduled: ScheduledEffect[];
  ongoing: OngoingEffect[];
  active: ActivePolicy[];
  cooldowns: Record<string, number>;
  landed: LandedEffect[];
  events: EventsState;
  news: NewsState;
  term: number;
  termEndTick: number;
  elections: ElectionResult[];
  timeline: TimelineEntry[];
  stats: RunStats;
  startStats: StartStats;
  counters: Counters;
  status: EndStatus;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function defaultBudget(): Budget {
  return { shares: { ...DEFAULT_SHARES }, allocation: { ...DEFAULT_ALLOCATION } };
}

function seedStates(rng: Rng): StateData[] {
  return STATE_ROWS.map(([id, name, zone, popM, areaKm2, revenueBase, traits]) => {
    const base = [...ZONE_BASE_STATS[zone]];
    const over = STATE_OVERRIDES[id] ?? [];
    const v = base.map((b, i) => over[i] ?? clamp(b + rng.range(-4, 4)));
    const [economy, security, health, education, infrastructure, power, welfare] = v;
    return {
      id, name, zone, traits, revenueBase, areaKm2,
      population: popM * 1_000_000,
      governor: `${rng.pick(GOVERNOR_TITLES)} ${rng.pick(GOVERNOR_FIRST_NAMES)} ${rng.pick(GOVERNOR_LAST_NAMES)}`,
      economy, security, health, education, infrastructure, power, welfare,
      mood: 50,
      unrest: clamp(rng.range(10, 25)),
      corruption: clamp(rng.normal(35, 7)),
      insurgencyRisk: hazardBase(id, zone, traits),
      governorLoyalty: clamp(rng.normal(50, 12)),
      eventMood: 0,
      modifiers: [],
    };
  });
}

export function createGame(config: GameConfig = DEFAULT_CONFIG): GameState {
  const seed = config.seed || Date.now().toString(36);
  const rng = Rng.fromSeed(seed);
  const states = seedStates(rng);
  const game: GameState = {
    version: 1,
    config: { ...config, seed },
    seed,
    rngState: 0,
    tick: 0,
    states,
    national: {
      treasury: DIFFICULTY[config.difficulty].startingTreasury,
      debt: 3000,
      inflation: 15,
      nairaStrength: 50,
      oilPriceIndex: 1,
      approval: 50,
      stability: 60,
      assemblySupport: 55,
      opposition: 40,
      revenue: 38,
      spending: 0,
      crisisLoad: 0,
    },
    budget: defaultBudget(),
    programmePerTick: 0,
    budgetWindowOpen: false,
    scheduled: [],
    ongoing: [],
    active: [],
    cooldowns: {},
    landed: [],
    events: emptyEventsState(),
    news: emptyNewsState(),
    term: 1,
    termEndTick: config.termYears * TICKS_PER_YEAR,
    elections: [],
    timeline: [],
    stats: { ticks: 0, approvalSum: 0, stabilitySum: 0, peakInflation: 15, minTreasury: DIFFICULTY[config.difficulty].startingTreasury },
    startStats: { mood: 50, economy: 0, security: 0, health: 0, education: 0, infrastructure: 0, power: 0, welfare: 0 },
    counters: { coup: 0, impeachment: 0, collapse: 0 },
    status: { kind: 'running' },
  };
  game.rngState = rng.state;
  return game;
}

export function totalPopulation(g: GameState): number {
  let t = 0;
  for (const s of g.states) t += s.population;
  return t;
}
