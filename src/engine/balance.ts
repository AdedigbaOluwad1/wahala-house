import type { Difficulty, Sector } from './state';

export const TICKS_PER_QUARTER = 13;
export const TICKS_PER_YEAR = 52;
export const SECONDS_PER_TICK = { slow: 7, normal: 4, fast: 1.5 } as const;

export const DEFAULT_SHARES: Record<Sector, number> = {
  security: 0.2,
  health: 0.14,
  education: 0.14,
  infrastructure: 0.16,
  power: 0.14,
  economy: 0.12,
  welfare: 0.1,
};
export const DEFAULT_ALLOCATION = { need: 0.4, population: 0.5, loyalty: 0.1 };

export const REFERENCE_PROGRAMME_PER_TICK = 32;
export const FULL_FUNDING_GAIN = 0.4;
export const BASE_DECAY = 0.365;
export const DIMINISHING_ABOVE = 80;
export const MAX_FUNDING_RATIO = 1.5;
export const MAX_LEAKAGE = 0.5;

export const CROSS_EFFECTS: ReadonlyArray<readonly [string, string, number]> = [
  ['power', 'economy', 0.04],
  ['infrastructure', 'economy', 0.04],
  ['infrastructure', 'health', 0.015],
  ['security', 'economy', 0.04],
  ['security', 'health', 0.015],
  ['health', 'economy', 0.03],
  ['education', 'economy', 0.015],
];
export const INFLATION_ECONOMY_DRAG = 0.02;

export const MOOD_WEIGHTS = {
  economy: 0.25,
  security: 0.25,
  health: 0.15,
  power: 0.1,
  infrastructure: 0.1,
  education: 0.05,
  welfare: 0.1,
} as const;
export const NEUTRAL_INFLATION = 10;
export const INFLATION_MOOD_PENALTY = 0.5;
export const UNREST_MOOD_PENALTY = 0.25;
export const EVENT_MOOD_DECAY = 0.9;

export const UNREST_LOW_MOOD = 40;
export const UNREST_HIGH_MOOD = 60;
export const UNREST_RATE = 0.02;
export const UNREST_RELAX = 0.005;
export const UNREST_FLOOR = 10;
export const CORRUPTION_DRIFT = 0.01;
export const INSURGENCY_REVERT = 0.03;
export const LOYALTY_RATE = 0.3;
export const LOYALTY_MAX_STEP = 0.3;

export const OIL_OUTPUT = 18;
export const TAX_K = 0.0145;
export const OTHER_REVENUE = 4;
export const DEFICIT_ALLOWANCE = 0.08;
export const BASE_INTEREST = 0.06;
export const DEBT_CEILING = 6000;
export const TREASURY_RESERVE = 100;
export const BORROW_PREMIUM = 0.06;

export const APPROVAL_SMOOTHING = 4;
export const CRISIS_DECAY = 0.04;
export const CRISIS_PER_SEVERITY = { 1: 0.5, 2: 2, 3: 7 } as const;

export const COUP = { stability: 42, ticks: 12 };
export const IMPEACHMENT = { approval: 30, assembly: 35, opposition: 60, ticks: 8 };
export const COLLAPSE = { unrest: 50, ticks: 4 };

export interface DifficultyScale {
  startingTreasury: number;
  decayMult: number;
  approvalSensitivity: number;
  assemblyResistance: number;
  eventFrequency: number;
}
export const DIFFICULTY: Record<Difficulty, DifficultyScale> = {
  easy: { startingTreasury: 1500, decayMult: 0.93, approvalSensitivity: 0.85, assemblyResistance: 0.8, eventFrequency: 0.7 },
  realistic: { startingTreasury: 1000, decayMult: 1, approvalSensitivity: 1, assemblyResistance: 1, eventFrequency: 1 },
  brutal: { startingTreasury: 600, decayMult: 1.04, approvalSensitivity: 1.1, assemblyResistance: 1.3, eventFrequency: 1.4 },
};

export const ASSEMBLY = {
  defaultThreshold: 50,
  noise: 6,
  costPerPoint: 8,
  maxBonus: 30,
  failPenalty: 6,
  retryTicks: 4,
};

export const EVENTS = {
  graceTicks: 6,
  maxFiresPerTick: 2,
  maxActive: 4,
  optionalWindow: 8,
  historyCap: 300,
};

export const NEWS = {
  cap: 250,
  ambientChance: 0.07,
  ambientCooldown: 26,
};

export const ELECTION = {
  minShare: 0.25,
  statesRequiredFraction: 2 / 3,
  fctSeparate: true,
  exponent: 2.2,
  noise: 0.04,
  swingSd: 4,
  baseTurnout: 0.45,
  turnoutMoodWeight: 0.2,
  runoffAntiIncumbentTransfer: 0.7,
  honeymoon: { stability: 5, opposition: -5, assemblySupport: 5, approval: 4 },
};

export const SCORE = {
  perElectionWon: 500,
  termLimitBonus: 300,
  base: 0.4,
  approvalWeight: 0.3,
  stabilityWeight: 0.3,
};
