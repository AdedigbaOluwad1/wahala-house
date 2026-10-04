import { ELECTION, TICKS_PER_YEAR } from "./balance";
import { Rng } from "./rng";
import type { GameState, StateData } from "./state";

export type Candidate = "player" | "uda" | "third";

export interface StateVote {
  stateId: string;
  votes: Record<Candidate, number>;
  shares: Record<Candidate, number>;
  leader: Candidate;
}

export interface ElectionRound {
  states: StateVote[];
  totals: Record<Candidate, number>;
  nationalShares: Record<Candidate, number>;
  leader: Candidate;
  statesMeeting: Record<Candidate, number>;
  fctMet: Record<Candidate, boolean>;
  spreadMet: Record<Candidate, boolean>;
  statesRequired: number;
}

export interface ElectionResult {
  tick: number;
  term: number;
  first: ElectionRound;
  runoff?: ElectionRound;
  winner: Candidate;
  playerWon: boolean;
  runoffHeld: boolean;
  lostOnSpread: boolean;
}

const CANDIDATES: Candidate[] = ["player", "uda", "third"];
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

function strengths(
  g: GameState,
  s: StateData,
  swing: number,
): Record<Candidate, number> {
  const n = g.national;
  const player = clamp(
    swing +
      0.45 * s.mood +
      0.2 * n.approval +
      0.15 * s.governorLoyalty +
      0.1 * n.stability +
      0.1 * (100 - n.opposition),
  );
  const uda = clamp(
    0.5 * (100 - s.mood) + 0.3 * n.opposition + 0.2 * (100 - s.governorLoyalty),
  );
  const third = clamp(8 + 0.15 * s.unrest);
  return { player, uda, third };
}

function emptyTotals(): Record<Candidate, number> {
  return { player: 0, uda: 0, third: 0 };
}

function countRound(
  g: GameState,
  rng: Rng,
  candidates: Candidate[],
  eliminated?: ElectionRound,
  dropped?: Candidate,
): ElectionRound {
  const states: StateVote[] = [];
  const totals = emptyTotals();
  const swing = rng.normal(0, ELECTION.swingSd);
  for (const s of g.states) {
    const str = strengths(g, s, swing);
    if (eliminated && dropped) {
      const freed =
        eliminated.states.find((v) => v.stateId === s.id)!.shares[dropped] *
        100;
      const t = ELECTION.runoffAntiIncumbentTransfer;
      for (const c of candidates)
        str[c] +=
          freed *
          (c === "player"
            ? 1 - t
            : c === candidates.find((x) => x !== "player")
              ? t
              : 0.5);
    }
    const weights = emptyTotals();
    for (const c of candidates)
      weights[c] =
        Math.max(1, str[c] + rng.normal(0, ELECTION.noise * 100)) **
        ELECTION.exponent;
    const sum = candidates.reduce((a, c) => a + weights[c], 0);
    const turnout =
      s.population *
      (ELECTION.baseTurnout + ELECTION.turnoutMoodWeight * (s.mood / 100));
    const votes = emptyTotals();
    const shares = emptyTotals();
    for (const c of candidates) {
      shares[c] = weights[c] / sum;
      votes[c] = shares[c] * turnout;
      totals[c] += votes[c];
    }
    const leader = candidates.reduce(
      (a, c) => (votes[c] > votes[a] ? c : a),
      candidates[0],
    );
    states.push({ stateId: s.id, votes, shares, leader });
  }
  const grand = candidates.reduce((a, c) => a + totals[c], 0);
  const nationalShares = emptyTotals();
  for (const c of candidates) nationalShares[c] = totals[c] / grand;

  const proper = g.states.filter((s) => s.id !== "fct");
  const statesRequired = Math.ceil(
    proper.length * ELECTION.statesRequiredFraction,
  );
  const statesMeeting = emptyTotals();
  const fctMet: Record<Candidate, boolean> = {
    player: false,
    uda: false,
    third: false,
  };
  for (const v of states) {
    for (const c of candidates) {
      if (v.shares[c] < ELECTION.minShare) continue;
      if (v.stateId === "fct") fctMet[c] = true;
      else statesMeeting[c]++;
    }
  }
  const spreadMet: Record<Candidate, boolean> = {
    player: false,
    uda: false,
    third: false,
  };
  for (const c of candidates) {
    spreadMet[c] =
      statesMeeting[c] >= statesRequired &&
      (!ELECTION.fctSeparate || fctMet[c]);
  }
  const leader = candidates.reduce(
    (a, c) => (totals[c] > totals[a] ? c : a),
    candidates[0],
  );
  return {
    states,
    totals,
    nationalShares,
    leader,
    statesMeeting,
    fctMet,
    spreadMet,
    statesRequired,
  };
}

export function runElection(g: GameState, rng: Rng): ElectionResult {
  const first = countRound(g, rng, CANDIDATES);
  let winner: Candidate | null = first.spreadMet[first.leader]
    ? first.leader
    : null;
  let runoff: ElectionRound | undefined;
  let runoffHeld = false;
  const lostOnSpread = winner === null;

  if (winner === null) {
    runoffHeld = true;
    const ranked = [...CANDIDATES].sort(
      (a, b) => first.totals[b] - first.totals[a],
    );
    const finalists = ranked.slice(0, 2);
    const dropped = ranked[2];
    runoff = countRound(g, rng, finalists, first, dropped);
    const w = runoff.leader;
    winner = w;
  }
  return {
    tick: g.tick,
    term: g.term,
    first,
    runoff,
    winner,
    playerWon: winner === "player",
    runoffHeld,
    lostOnSpread,
  };
}

export function termsRemaining(g: GameState): boolean {
  const allowed = g.config.termsAllowed;
  return allowed === "unlimited" || g.term < allowed;
}

export function resolveTermEnd(g: GameState): ElectionResult | null {
  if (g.status.kind !== "term_end") return null;
  if (!termsRemaining(g)) {
    g.status = { kind: "finished", outcome: "term_limit", tick: g.tick };
    g.timeline.push({ tick: g.tick, type: "ended" });
    return null;
  }
  const rng = new Rng(g.rngState);
  const result = runElection(g, rng);
  g.rngState = rng.state;
  g.elections.push(result);
  g.timeline.push({ tick: g.tick, type: "election", won: result.playerWon });
  if (result.playerWon) {
    g.term++;
    g.termEndTick = g.tick + g.config.termYears * TICKS_PER_YEAR;
    g.status = { kind: "running" };
    const h = ELECTION.honeymoon;
    g.national.stability = clamp(g.national.stability + h.stability);
    g.national.opposition = clamp(g.national.opposition + h.opposition);
    g.national.assemblySupport = clamp(
      g.national.assemblySupport + h.assemblySupport,
    );
    g.national.approval = clamp(g.national.approval + h.approval);
    g.counters = { coup: 0, impeachment: 0, collapse: 0 };
  } else {
    g.status = { kind: "finished", outcome: "voted_out", tick: g.tick };
    g.timeline.push({ tick: g.tick, type: "ended" });
  }
  return result;
}

export function awaitingElection(g: GameState): boolean {
  return g.status.kind === "term_end";
}
