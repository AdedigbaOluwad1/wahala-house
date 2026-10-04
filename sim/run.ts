import {
  DIFFICULTY,
  awaitingElection,
  computeScore,
  newGame,
  outcomeOf,
  resolveTermEnd,
  stepTick,
} from "../src/engine";
import { EVENTS } from "../src/content/events";
import type { Difficulty, GameConfig, GameState } from "../src/engine";
import { BOTS } from "./bots";
import type { Bot } from "./bots";

export interface RunResult {
  outcome: string;
  ticks: number;
  elections: number;
  electionsWon: number;
  approval: number;
  score: number;
  fires: Record<string, number>;
  cooldownViolations: string[];
}

export function playOne(
  bot: Bot,
  config: GameConfig,
  maxTicks = 52 * 12,
): RunResult {
  const g = newGame(config);
  while (g.status.kind === "running" && g.tick < maxTicks) {
    bot.act(g);
    stepTick(g);
    if (awaitingElection(g)) resolveTermEnd(g);
  }
  bot.act(g);
  return summarise(g);
}

function summarise(g: GameState): RunResult {
  const fires: Record<string, number> = {};
  const lastFire: Record<string, number> = {};
  const violations: string[] = [];
  for (const r of g.events.history) {
    fires[r.eventId] = (fires[r.eventId] ?? 0) + 1;
    const key = r.stateId ? `${r.eventId}:${r.stateId}` : r.eventId;
    const ev = EVENTS.find((e) => e.id === r.eventId);
    const prev = lastFire[key];
    if (ev && prev !== undefined && r.firedTick - prev < ev.cooldownTicks)
      violations.push(`${key}@${r.firedTick}`);
    lastFire[key] = r.firedTick;
  }
  return {
    outcome: outcomeOf(g.status),
    ticks: g.stats.ticks,
    elections: g.elections.length,
    electionsWon: g.elections.filter((e) => e.playerWon).length,
    approval: g.stats.approvalSum / Math.max(1, g.stats.ticks),
    score: computeScore(g),
    fires,
    cooldownViolations: violations,
  };
}

function firstElection(rs: RunResult[]): string {
  const held = rs.filter((r) => r.elections > 0 || r.outcome === "term_limit");
  if (held.length === 0) return "    -";
  const won = held.filter(
    (r) => r.electionsWon > 0 || r.outcome === "term_limit",
  ).length;
  return `${pct(won, held.length)} of ${held.length}`;
}

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const pct = (n: number, d: number) =>
  `${Math.round((100 * n) / d)}%`.padStart(4);

export function runBatch(
  seeds: number,
  difficulties: Difficulty[],
  overrides: Partial<GameConfig> = {},
) {
  const table: string[] = [];
  const allFires: Record<string, number> = {};
  const violations: string[] = [];
  let games = 0;
  for (const difficulty of difficulties) {
    table.push(
      `\n== ${difficulty} (${seeds} seeds, startingTreasury ${DIFFICULTY[difficulty].startingTreasury}) ==`,
    );
    table.push(
      "bot         coup  impch  colps  voted  limit | removal yrs  appr  score | 1st-election win",
    );
    for (const bot of BOTS) {
      const rs: RunResult[] = [];
      for (let i = 0; i < seeds; i++) {
        const r = playOne(bot, {
          mode: "term",
          termYears: 4,
          termsAllowed: 2,
          difficulty,
          speed: "fast",
          tone: "dry",
          language: "en",
          ...overrides,
          seed: `${bot.name}-${difficulty}-${i}`,
        });
        rs.push(r);
        games++;
        for (const [id, n] of Object.entries(r.fires))
          allFires[id] = (allFires[id] ?? 0) + n;
        violations.push(...r.cooldownViolations);
      }
      const count = (o: string) => rs.filter((r) => r.outcome === o).length;
      const removed = rs.filter((r) =>
        ["coup", "impeachment", "collapse"].includes(r.outcome),
      );
      table.push(
        `${bot.name.padEnd(11)} ${pct(count("coup"), seeds)}  ${pct(count("impeachment"), seeds)}   ${pct(count("collapse"), seeds)}   ${pct(count("voted_out"), seeds)}   ${pct(count("term_limit"), seeds)} | ` +
          `${removed.length ? (mean(removed.map((r) => r.ticks)) / 52).toFixed(1).padStart(5) : "    -"}  ${(mean(rs.map((r) => r.ticks)) / 52).toFixed(1).padStart(4)}  ${mean(
            rs.map((r) => r.approval),
          )
            .toFixed(0)
            .padStart(4)}  ${mean(rs.map((r) => r.score))
            .toFixed(0)
            .padStart(5)} | ${firstElection(rs)}`,
      );
    }
  }
  return { table: table.join("\n"), fires: allFires, violations, games };
}
