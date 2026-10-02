import { DIFFICULTY, DEFAULT_ALLOCATION, DEFAULT_SHARES } from './balance';
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

export type Effect =
  | { kind: 'stat'; target: StatKey | 'mood' | 'unrest' | 'corruption'; stateId: string | 'all'; delta: number }
  | { kind: 'national'; meter: 'treasury' | 'inflation' | 'nairaStrength' | 'approval' | 'stability' | 'assemblySupport' | 'opposition' | 'crisisLoad'; delta: number };

export interface ScheduledEffect {
  applyAtTick: number;
  effect: Effect;
}

export type EndStatus =
  | { kind: 'running' }
  | { kind: 'removed'; reason: 'coup' | 'impeachment' | 'collapse'; tick: number }
  | { kind: 'term_end'; tick: number };

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
