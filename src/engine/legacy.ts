import { DEFAULT_SHARES, SCORE, TICKS_PER_YEAR } from "./balance";
import { weightedMean } from "./aggregate";
import type { ElectionResult } from "./election";
import { getPolicy } from "./policies";
import { SECTORS } from "./state";
import type {
  EndStatus,
  GameState,
  Sector,
  StatKey,
  TimelineEntry,
} from "./state";

export type Outcome =
  "coup" | "impeachment" | "collapse" | "voted_out" | "term_limit" | "ongoing";

export interface StatChange {
  stat: StatKey | "mood";
  start: number;
  end: number;
  delta: number;
}

export interface RankedState {
  id: string;
  name: string;
  mood: number;
}

export type Tradeoff =
  | { kind: "policy"; policyId: string; text: string }
  | {
      kind: "budget";
      highSector: Sector;
      lowSector: Sector;
      highShare: number;
      lowShare: number;
    }
  | { kind: "none" };

export interface Legacy {
  outcome: Outcome;
  ticks: number;
  years: number;
  term: number;
  score: number;
  avgApproval: number;
  avgStability: number;
  peakInflation: number;
  electionsWon: number;
  electionsLost: number;
  finalMeters: {
    treasury: number;
    debt: number;
    inflation: number;
    approval: number;
    stability: number;
  };
  changes: StatChange[];
  traded: StatChange[];
  best: RankedState[];
  worst: RankedState[];
  tradeoff: Tradeoff;
  timeline: TimelineEntry[];
  elections: ElectionResult[];
}

export function outcomeOf(status: EndStatus): Outcome {
  if (status.kind === "removed") return status.reason;
  if (status.kind === "finished") return status.outcome;
  return "ongoing";
}

export function computeScore(g: GameState): number {
  const ticks = Math.max(1, g.stats.ticks);
  const avgApproval = g.stats.approvalSum / ticks;
  const avgStability = g.stats.stabilitySum / ticks;
  const won = g.elections.filter((e) => e.playerWon).length;
  const base =
    ticks *
    (SCORE.base +
      (SCORE.approvalWeight * avgApproval) / 100 +
      (SCORE.stabilityWeight * avgStability) / 100);
  const bonus =
    won * SCORE.perElectionWon +
    (g.status.kind === "finished" && g.status.outcome === "term_limit"
      ? SCORE.termLimitBonus
      : 0);
  return Math.round(base + bonus);
}

function rankedStates(g: GameState): RankedState[] {
  return g.states
    .map((s) => ({ id: s.id, name: s.name, mood: s.mood }))
    .sort((a, b) => b.mood - a.mood);
}

function biggestTradeoff(g: GameState): Tradeoff {
  const policyIds = g.timeline
    .filter((t) => t.type === "policy" && t.refId)
    .map((t) => t.refId!);
  let best: { id: string; weight: number } | null = null;
  for (const id of new Set(policyIds)) {
    const policy = getPolicy(id);
    if (!policy) continue;
    const landed = g.landed.filter(
      (l) => l.policyId === id && l.phase === "side",
    ).length;
    const weight =
      landed * 10 +
      policy.sideEffects.length +
      (policy.cost + (policy.runningCost ?? 0) * 20) / 100;
    if (!best || weight > best.weight) best = { id, weight };
  }
  if (best)
    return {
      kind: "policy",
      policyId: best.id,
      text: getPolicy(best.id)!.tradeoff,
    };

  const ratios = SECTORS.map((k) => ({
    k,
    share: g.budget.shares[k],
    rel: g.budget.shares[k] / DEFAULT_SHARES[k],
  }));
  const high = [...ratios].sort((a, b) => b.rel - a.rel)[0];
  const low = [...ratios].sort((a, b) => a.rel - b.rel)[0];
  if (high.rel - low.rel < 0.15) return { kind: "none" };
  return {
    kind: "budget",
    highSector: high.k,
    lowSector: low.k,
    highShare: high.share,
    lowShare: low.share,
  };
}

export function buildLegacy(g: GameState): Legacy {
  const ticks = g.stats.ticks;
  const n = g.national;
  const now: Record<StatKey | "mood", number> = {
    mood: weightedMean(g, (s) => s.mood),
    economy: weightedMean(g, (s) => s.economy),
    security: weightedMean(g, (s) => s.security),
    health: weightedMean(g, (s) => s.health),
    education: weightedMean(g, (s) => s.education),
    infrastructure: weightedMean(g, (s) => s.infrastructure),
    power: weightedMean(g, (s) => s.power),
    welfare: weightedMean(g, (s) => s.welfare),
  };
  const changes: StatChange[] = (Object.keys(now) as (StatKey | "mood")[]).map(
    (stat) => ({
      stat,
      start: g.startStats[stat],
      end: now[stat],
      delta: now[stat] - g.startStats[stat],
    }),
  );
  const ranked = rankedStates(g);
  return {
    outcome: outcomeOf(g.status),
    ticks,
    years: ticks / TICKS_PER_YEAR,
    term: g.term,
    score: computeScore(g),
    avgApproval: g.stats.approvalSum / Math.max(1, ticks),
    avgStability: g.stats.stabilitySum / Math.max(1, ticks),
    peakInflation: g.stats.peakInflation,
    electionsWon: g.elections.filter((e) => e.playerWon).length,
    electionsLost: g.elections.filter((e) => !e.playerWon).length,
    finalMeters: {
      treasury: n.treasury,
      debt: n.debt,
      inflation: n.inflation,
      approval: n.approval,
      stability: n.stability,
    },
    changes,
    traded: changes
      .filter((c) => c.stat !== "mood" && c.delta < -1)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 3),
    best: ranked.slice(0, 3),
    worst: ranked.slice(-3).reverse(),
    tradeoff: biggestTradeoff(g),
    timeline: g.timeline,
    elections: g.elections,
  };
}
