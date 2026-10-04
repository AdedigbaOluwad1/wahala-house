import {
  awaitingElection,
  newGame,
  resolveTermEnd,
  stepTick,
  coupThreshold,
} from "../src/engine";
import { weightedMean } from "../src/engine/aggregate";
import { BOTS } from "./bots";

const bot = BOTS.find((b) => b.name === process.argv[2])!;
const g = newGame({
  mode: "term",
  termYears: 4,
  termsAllowed: 2,
  difficulty: (process.argv[3] ?? "realistic") as "realistic",
  speed: "fast",
  tone: "dry",
  language: "en",
  seed: process.argv[4] ?? "trace",
});
while (g.status.kind === "running" && g.tick < 520) {
  bot.act(g);
  stepTick(g);
  if (awaitingElection(g)) resolveTermEnd(g);
  if (g.tick % 26 === 0) {
    const n = g.national;
    const w = (k: string) =>
      weightedMean(
        g,
        (s) => (s as unknown as Record<string, number>)[k],
      ).toFixed(0);
    console.log(
      `t${g.tick} appr${n.approval.toFixed(0)} stab${n.stability.toFixed(0)}/${coupThreshold(g).toFixed(0)} infl${n.inflation.toFixed(0)} trs${n.treasury.toFixed(0)} debt${n.debt.toFixed(0)} crisis${n.crisisLoad.toFixed(0)} unrest${w("unrest")} mood${w("mood")} eco${w("economy")} sec${w("security")} hlth${w("health")} pwr${w("power")} inf${w("infrastructure")} wel${w("welfare")} asm${n.assemblySupport.toFixed(0)} opp${n.opposition.toFixed(0)}`,
    );
  }
}
console.log(g.status);
