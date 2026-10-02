import {
  APPROVAL_SMOOTHING, BASE_DECAY, CORRUPTION_DRIFT, CRISIS_DECAY, CROSS_EFFECTS, DEBT_CEILING, DIFFICULTY,
  DIMINISHING_ABOVE, EVENT_MOOD_DECAY, FULL_FUNDING_GAIN, INFLATION_ECONOMY_DRAG, INFLATION_MOOD_PENALTY,
  INSURGENCY_REVERT, LOYALTY_MAX_STEP, LOYALTY_RATE, MAX_FUNDING_RATIO, MOOD_WEIGHTS, NEUTRAL_INFLATION, OIL_OUTPUT,
  OTHER_REVENUE, TAX_K, TREASURY_RESERVE, UNREST_HIGH_MOOD, UNREST_LOW_MOOD, UNREST_MOOD_PENALTY, UNREST_RATE,
} from './balance';
import { affordability, computeFunding, debtServicePerTick, needBaseline, openBudgetWindow } from './budget';
import type { Funding } from './budget';
import { isQuarterStart } from './clock';
import { weightedMean } from './aggregate';
import { resolveEvent, rollEvents } from './events';
import { checkThresholds, rollAmbient } from './news';
import { applyOngoing, applyScheduled, ongoingRevenue } from './effects';
import { enactPolicy, runningCostPerTick } from './policies';
import { checkEnd } from './endConditions';
import { Rng } from './rng';
import { SECTORS, createGame, totalPopulation } from './state';
import type { Budget, GameConfig, GameState, StatKey } from './state';
import { setBudget } from './budget';
import { hazardBase } from '../content/states';

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

function updateStats(g: GameState, funding: Funding): void {
  const decay = BASE_DECAY * DIFFICULTY[g.config.difficulty].decayMult;
  const infl = clamp((g.national.inflation - NEUTRAL_INFLATION) / 10, 0, 3);
  for (const s of g.states) {
    const delta: Record<StatKey, number> = { economy: 0, security: 0, health: 0, education: 0, infrastructure: 0, power: 0, welfare: 0 };
    for (const sector of SECTORS) {
      const ratio = clamp(funding[s.id][sector] / needBaseline(g, s, sector), 0, MAX_FUNDING_RATIO);
      const diminish = s[sector] > DIMINISHING_ABOVE ? 1 - (s[sector] - DIMINISHING_ABOVE) / 40 : 1;
      delta[sector] += FULL_FUNDING_GAIN * ratio * diminish - decay;
    }
    for (const [src, dst, k] of CROSS_EFFECTS) {
      delta[dst as StatKey] += (k * ((s[src as StatKey] as number) - 50)) / 50;
    }
    delta.economy -= INFLATION_ECONOMY_DRAG * infl;
    for (const m of s.modifiers) if (m.target !== 'mood') delta[m.target] += m.delta;
    for (const sector of SECTORS) s[sector] = clamp(s[sector] + delta[sector]);
  }
}

function updateHidden(g: GameState, funding: Funding): void {
  const total = totalPopulation(g);
  let fundedTotal = 0;
  const fundedBy = g.states.map((s) => {
    const f = SECTORS.reduce((a, k) => a + funding[s.id][k], 0);
    fundedTotal += f;
    return f;
  });
  g.states.forEach((s, i) => {
    const m = s.mood;
    if (m < UNREST_LOW_MOOD) s.unrest += (UNREST_LOW_MOOD - m) * UNREST_RATE;
    else if (m > UNREST_HIGH_MOOD) s.unrest -= (m - UNREST_HIGH_MOOD) * UNREST_RATE;
    s.unrest += (50 - s.economy) * 0.002 - (s.education - 50) * 0.001;
    s.unrest = clamp(s.unrest);

    const target = clamp(hazardBase(s.id, s.zone, s.traits) + (50 - s.security) * 0.4 + (50 - s.economy) * 0.2 + (40 - m) * 0.2);
    s.insurgencyRisk = clamp(s.insurgencyRisk + INSURGENCY_REVERT * (target - s.insurgencyRisk));

    s.corruption = clamp(s.corruption + CORRUPTION_DRIFT);

    const expected = (s.population / total) * fundedTotal;
    const ratio = expected > 0 ? fundedBy[i] / expected : 1;
    s.governorLoyalty = clamp(s.governorLoyalty + clamp(LOYALTY_RATE * (ratio - 1), -LOYALTY_MAX_STEP, LOYALTY_MAX_STEP));
  });
}

function updateMood(g: GameState): void {
  const sens = DIFFICULTY[g.config.difficulty].approvalSensitivity;
  const inflPenalty = Math.max(0, g.national.inflation - NEUTRAL_INFLATION) * INFLATION_MOOD_PENALTY * sens;
  for (const s of g.states) {
    let base = 0;
    for (const k of Object.keys(MOOD_WEIGHTS) as (keyof typeof MOOD_WEIGHTS)[]) base += MOOD_WEIGHTS[k] * s[k];
    let modMood = 0;
    for (const m of s.modifiers) if (m.target === 'mood') modMood += m.delta;
    s.eventMood *= EVENT_MOOD_DECAY;
    s.mood = clamp(base - inflPenalty - s.unrest * UNREST_MOOD_PENALTY * sens + s.eventMood + modMood);
    s.modifiers = s.modifiers.filter((m) => --m.ticksLeft > 0);
  }
}

function updateNational(g: GameState, rng: Rng): void {
  const n = g.national;
  const sens = DIFFICULTY[g.config.difficulty];

  n.oilPriceIndex = clamp(n.oilPriceIndex + (1 - n.oilPriceIndex) * 0.02 + rng.normal(0, 0.03) + (rng.chance(0.01) ? rng.range(-0.25, 0.25) : 0), 0.4, 1.8);

  const vandalism = clamp(weightedMean(g, (s) => (s.traits.includes('oil') ? s.insurgencyRisk : 0)) / 100, 0, 0.6) * 0.5;
  const oil = n.oilPriceIndex * OIL_OUTPUT * (1 - vandalism);
  let tax = 0;
  for (const s of g.states) tax += (s.economy / 50) * s.revenueBase * TAX_K;
  n.revenue = oil + tax + OTHER_REVENUE + ongoingRevenue(g);

  const debtService = debtServicePerTick(g);
  const programme = g.programmePerTick * affordability(g);
  n.spending = programme + debtService + runningCostPerTick(g);
  n.treasury += n.revenue - n.spending;
  if (n.treasury < TREASURY_RESERVE && n.debt < DEBT_CEILING) {
    const borrow = Math.min(TREASURY_RESERVE - n.treasury, DEBT_CEILING - n.debt);
    n.debt += borrow;
    n.treasury += borrow;
  }
  n.treasury = Math.max(0, n.treasury);

  const deficit = Math.max(0, n.spending - n.revenue) / Math.max(1, n.revenue);
  n.inflation = Math.max(0, n.inflation + deficit * 0.5 + (Math.max(0, 50 - n.nairaStrength) / 50) * 0.3 - 0.02 * (n.inflation - NEUTRAL_INFLATION));
  const nairaTarget = clamp(50 + (n.oilPriceIndex - 1) * 40 - deficit * 40);
  n.nairaStrength = clamp(n.nairaStrength + 0.1 * (nairaTarget - n.nairaStrength));

  const moodTarget = weightedMean(g, (s) => s.mood);
  n.approval = clamp(n.approval + (moodTarget - n.approval) / APPROVAL_SMOOTHING);
  const unrest = weightedMean(g, (s) => s.unrest);
  const security = weightedMean(g, (s) => s.security);
  n.crisisLoad = clamp(n.crisisLoad * (1 - CRISIS_DECAY));

  const assemblyTarget = clamp(0.4 * weightedMean(g, (s) => s.governorLoyalty) + 0.3 * n.approval + 20 - (sens.assemblyResistance - 1) * 20);
  n.assemblySupport = clamp(n.assemblySupport + 0.05 * (assemblyTarget - n.assemblySupport));
  const oppTarget = clamp(100 - n.approval + unrest * 0.3);
  n.opposition = clamp(n.opposition + 0.05 * (oppTarget - n.opposition));

  const stabilityTarget = 0.3 * n.approval + 0.25 * (100 - unrest) + 0.2 * security + 0.15 * n.assemblySupport + 0.1 * (100 - n.crisisLoad);
  n.stability = clamp(n.stability + 0.1 * (stabilityTarget - n.stability));
}

export function stepTick(g: GameState): void {
  if (g.status.kind !== 'running') return;
  const rng = new Rng(g.rngState);

  g.tick++;
  if (isQuarterStart(g.tick)) openBudgetWindow(g);
  applyScheduled(g);
  applyOngoing(g);
  const funding = computeFunding(g);
  updateStats(g, funding);
  updateHidden(g, funding);
  updateMood(g);
  updateNational(g, rng);
  rollEvents(g, rng);
  checkThresholds(g);
  rollAmbient(g, rng);
  checkEnd(g);

  g.rngState = rng.state;
}

export function newGame(config?: GameConfig): GameState {
  const g = createGame(config);
  updateMood(g);
  g.national.approval = weightedMean(g, (s) => s.mood);
  openBudgetWindow(g);
  return g;
}

export type Action =
  | { tick: number; type: 'setBudget'; budget: Budget }
  | { tick: number; type: 'enactPolicy'; policyId: string; sweetener?: number; zone?: string }
  | { tick: number; type: 'resolveEvent'; uid: number; choiceId: string };

export function applyAction(g: GameState, action: Action): void {
  if (action.type === 'setBudget') setBudget(g, action.budget);
  else if (action.type === 'resolveEvent') resolveEvent(g, action.uid, action.choiceId);
  else enactPolicy(g, action.policyId, { sweetener: action.sweetener, zone: action.zone });
}

export function replay(config: GameConfig, actions: Action[], ticks: number): GameState {
  const g = newGame(config);
  const queue = [...actions].sort((a, b) => a.tick - b.tick);
  let i = 0;
  while (g.tick < ticks && g.status.kind === 'running') {
    while (i < queue.length && queue[i].tick <= g.tick) applyAction(g, queue[i++]);
    stepTick(g);
  }
  return g;
}
