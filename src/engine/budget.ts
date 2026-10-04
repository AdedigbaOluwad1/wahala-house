import {
  DEBT_CEILING,
  DEFICIT_ALLOWANCE,
  BASE_INTEREST,
  BORROW_PREMIUM,
  MAX_LEAKAGE,
  REFERENCE_PROGRAMME_PER_TICK,
  DEFAULT_SHARES,
} from "./balance";
import { SECTORS, totalPopulation } from "./state";
import type { Budget, GameState, Sector, StateData } from "./state";

export type Funding = Record<string, Record<Sector, number>>;

export function leakage(s: StateData): number {
  return Math.min(MAX_LEAKAGE, Math.max(0, (s.corruption / 100) * 0.5));
}

export function debtInterestRate(g: GameState): number {
  return BASE_INTEREST + BORROW_PREMIUM * (g.national.debt / DEBT_CEILING);
}

export function debtServicePerTick(g: GameState): number {
  return (g.national.debt * debtInterestRate(g)) / 52;
}

const TRAIT_NEED: Partial<Record<Sector, Partial<Record<string, number>>>> = {
  security: { conflict_zone: 0.5, border: 0.2 },
  infrastructure: { urban_dense: 0.3, flood_prone: 0.2 },
  health: { urban_dense: 0.2 },
  power: { commercial_hub: 0.3 },
  economy: { commercial_hub: 0.2 },
};

export function needBaseline(
  g: GameState,
  s: StateData,
  sector: Sector,
): number {
  let mult = 1;
  for (const t of s.traits) mult += TRAIT_NEED[sector]?.[t] ?? 0;
  return (
    REFERENCE_PROGRAMME_PER_TICK *
    DEFAULT_SHARES[sector] *
    (s.population / totalPopulation(g)) *
    mult
  );
}

function normalise(values: number[]): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  return sum > 0
    ? values.map((v) => v / sum)
    : values.map(() => 1 / values.length);
}

export function stateShares(
  g: GameState,
  sector: Sector,
  allocation: Budget["allocation"],
): number[] {
  const total = totalPopulation(g);
  const need = normalise(g.states.map((s) => 100 - s[sector] + 1));
  const pop = g.states.map((s) => s.population / total);
  const loyalty = normalise(g.states.map((s) => s.governorLoyalty + 1));
  return g.states.map(
    (_, i) =>
      allocation.need * need[i] +
      allocation.population * pop[i] +
      allocation.loyalty * loyalty[i],
  );
}

export function affordability(g: GameState): number {
  const desired = g.programmePerTick + debtServicePerTick(g);
  if (desired <= 0) return 1;
  const available =
    g.national.treasury +
    g.national.revenue +
    Math.max(0, DEBT_CEILING - g.national.debt) -
    debtServicePerTick(g);
  return Math.min(1, Math.max(0, available / g.programmePerTick));
}

export function computeFunding(g: GameState): Funding {
  const scale = affordability(g);
  const out: Funding = {};
  for (const s of g.states) out[s.id] = {} as Record<Sector, number>;
  const keep = g.states.map((s) => 1 - leakage(s));
  for (const sector of SECTORS) {
    const national = g.programmePerTick * g.budget.shares[sector] * scale;
    const shares = stateShares(g, sector, g.budget.allocation);
    g.states.forEach((s, i) => {
      out[s.id][sector] = national * shares[i] * keep[i];
    });
  }
  return out;
}

export function validateBudget(b: Budget): string | null {
  const sum = (o: Record<string, number>) =>
    Object.values(o).reduce((a, c) => a + c, 0);
  if (
    Object.values(b.shares).some((v) => v < 0) ||
    Object.values(b.allocation).some((v) => v < 0)
  )
    return "negative share";
  if (Math.abs(sum(b.shares) - 1) > 1e-6) return "sector shares must sum to 1";
  if (Math.abs(sum(b.allocation) - 1) > 1e-6)
    return "allocation weights must sum to 1";
  return null;
}

export function setBudget(g: GameState, budget: Budget): void {
  const err = validateBudget(budget);
  if (err) throw new Error(`Invalid budget: ${err}`);
  g.budget = {
    shares: { ...budget.shares },
    allocation: { ...budget.allocation },
  };
  g.budgetWindowOpen = false;
}

export function openBudgetWindow(g: GameState): void {
  const envelopePerTick = g.national.revenue * (1 + DEFICIT_ALLOWANCE);
  g.programmePerTick = Math.max(0, envelopePerTick - debtServicePerTick(g));
  g.budgetWindowOpen = true;
}

export function projectedFundingRatios(
  g: GameState,
  budget: Budget,
): Record<Sector, number> {
  const out = {} as Record<Sector, number>;
  for (const sector of SECTORS) {
    const shares = stateShares(g, sector, budget.allocation);
    let funded = 0;
    let need = 0;
    g.states.forEach((s, i) => {
      funded +=
        g.programmePerTick *
        budget.shares[sector] *
        shares[i] *
        (1 - leakage(s));
      need += needBaseline(g, s, sector);
    });
    out[sector] = need > 0 ? funded / need : 0;
  }
  return out;
}
