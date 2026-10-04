import { ASSEMBLY, DIFFICULTY } from "./balance";
import { pushNews } from "./news";
import { Rng } from "./rng";
import type { Effect, GameState } from "./state";
import { POLICIES } from "../content/policies";

export type AdvisorId = "finance" | "security" | "health" | "politics";
export const ADVISOR_IDS: AdvisorId[] = [
  "finance",
  "security",
  "health",
  "politics",
];

export type PolicyEffect = Effect & { after?: number; note?: string };

export interface Policy {
  id: string;
  name: string;
  description: string;
  category:
    | "fiscal"
    | "monetary"
    | "trade"
    | "security"
    | "energy"
    | "social"
    | "governance";
  cost: number;
  runningCost?: number;
  durationTicks?: number;
  delayTicks: number;
  delayRisk?: { chance: number; extraTicks: number };
  needsAssembly: boolean;
  assemblyThreshold?: number;
  cooldownTicks?: number;
  repeatable?: boolean;
  needsZone?: boolean;
  effects: PolicyEffect[];
  sideEffects: PolicyEffect[];
  advisorTake: Record<AdvisorId, string>;
  tradeoff: string;
}

export interface EnactOptions {
  sweetener?: number;
  zone?: string;
}

export interface VoteOdds {
  support: number;
  bonus: number;
  needed: number;
  chance: number;
}

export type EnactFailure =
  | "unknown_policy"
  | "game_over"
  | "already_active"
  | "cooldown"
  | "insufficient_funds"
  | "zone_required"
  | "vote_failed";

export type EnactResult =
  | { ok: true; vote?: VoteOdds & { passed: true }; delayedBy: number }
  | { ok: false; reason: EnactFailure; vote?: VoteOdds & { passed: false } };

export function getPolicy(id: string): Policy | undefined {
  return POLICIES.find((p) => p.id === id);
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

export function sweetenerBonus(amount: number): number {
  return Math.min(
    ASSEMBLY.maxBonus,
    Math.max(0, amount) / ASSEMBLY.costPerPoint,
  );
}

export function assemblyOdds(
  g: GameState,
  policy: Policy,
  sweetener = 0,
): VoteOdds {
  const resistance = DIFFICULTY[g.config.difficulty].assemblyResistance;
  const needed =
    (policy.assemblyThreshold ?? ASSEMBLY.defaultThreshold) +
    (resistance - 1) * 20;
  const bonus = sweetenerBonus(sweetener);
  const support = g.national.assemblySupport;
  const chance =
    0.5 * (1 + erf((support + bonus - needed) / (ASSEMBLY.noise * Math.SQRT2)));
  return { support, bonus, needed, chance };
}

export function isActive(g: GameState, policyId: string): boolean {
  return g.active.some(
    (a) =>
      a.policyId === policyId &&
      (a.endsTick === undefined || a.endsTick > g.tick),
  );
}

export function cooldownRemaining(g: GameState, policyId: string): number {
  return Math.max(0, (g.cooldowns[policyId] ?? 0) - g.tick);
}

export function runningCostPerTick(g: GameState): number {
  let total = 0;
  for (const a of g.active) {
    if (a.endsTick !== undefined && a.endsTick <= g.tick) continue;
    total += getPolicy(a.policyId)?.runningCost ?? 0;
  }
  return total;
}

export function pendingEffects(g: GameState, policyId: string) {
  return g.scheduled.filter((e) => e.policyId === policyId);
}

function resolveEffect(effect: PolicyEffect, zone?: string): Effect {
  const rest = { ...effect };
  delete rest.after;
  delete rest.note;
  if (
    (rest.kind === "stat" || rest.kind === "ongoing") &&
    rest.scope === "$zone"
  ) {
    return { ...rest, scope: `zone:${zone}` } as Effect;
  }
  return rest as Effect;
}

export function enactPolicy(
  g: GameState,
  policyId: string,
  opts: EnactOptions = {},
): EnactResult {
  const policy = getPolicy(policyId);
  if (!policy) return { ok: false, reason: "unknown_policy" };
  if (g.status.kind !== "running") return { ok: false, reason: "game_over" };
  if (!policy.repeatable && isActive(g, policyId))
    return { ok: false, reason: "already_active" };
  if (cooldownRemaining(g, policyId) > 0)
    return { ok: false, reason: "cooldown" };
  if (policy.needsZone && !opts.zone)
    return { ok: false, reason: "zone_required" };

  const sweetener = policy.needsAssembly ? Math.max(0, opts.sweetener ?? 0) : 0;
  if (g.national.treasury < policy.cost + sweetener)
    return { ok: false, reason: "insufficient_funds" };

  const rng = new Rng(g.rngState);
  let vote: (VoteOdds & { passed: true }) | undefined;
  if (policy.needsAssembly) {
    const odds = assemblyOdds(g, policy, sweetener);
    const passed =
      odds.support + odds.bonus + rng.normal(0, ASSEMBLY.noise) >= odds.needed;
    g.national.treasury -= sweetener;
    if (!passed) {
      g.national.assemblySupport = Math.max(
        0,
        g.national.assemblySupport - ASSEMBLY.failPenalty,
      );
      g.cooldowns[policyId] = g.tick + ASSEMBLY.retryTicks;
      g.rngState = rng.state;
      pushNews(g, "policy_vote_failed", { policy: policy.name });
      g.timeline.push({
        tick: g.tick,
        type: "policy_failed",
        refId: policy.id,
      });
      return {
        ok: false,
        reason: "vote_failed",
        vote: { ...odds, passed: false },
      };
    }
    vote = { ...odds, passed: true };
  }

  const delayedBy =
    policy.delayRisk && rng.chance(policy.delayRisk.chance)
      ? policy.delayRisk.extraTicks
      : 0;
  g.rngState = rng.state;
  g.national.treasury -= policy.cost;

  const schedule = (list: PolicyEffect[], phase: "main" | "side") => {
    for (const e of list) {
      const after = Math.max(1, e.after ?? policy.delayTicks + delayedBy);
      g.scheduled.push({
        applyAtTick: g.tick + after,
        effect: resolveEffect(e, opts.zone),
        policyId,
        phase,
        note: e.note,
      });
    }
  };
  schedule(policy.effects, "main");
  schedule(policy.sideEffects, "side");

  g.active = g.active.filter(
    (a) =>
      a.policyId !== policyId ||
      (a.endsTick !== undefined && a.endsTick <= g.tick),
  );
  g.active.push({
    policyId,
    enactedTick: g.tick,
    endsTick: policy.durationTicks ? g.tick + policy.durationTicks : undefined,
  });
  if (policy.cooldownTicks)
    g.cooldowns[policyId] = g.tick + policy.cooldownTicks;
  if (vote) pushNews(g, "policy_vote_passed", { policy: policy.name });
  pushNews(g, "policy_enacted", { policy: policy.name });
  g.timeline.push({ tick: g.tick, type: "policy", refId: policy.id });

  return { ok: true, vote, delayedBy };
}
