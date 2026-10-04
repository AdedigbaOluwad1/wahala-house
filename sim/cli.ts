import { EVENTS } from "../src/content/events";
import type { Difficulty } from "../src/engine";
import { runBatch } from "./run";

const seeds = Number(process.argv[2] ?? 100);
const only = process.argv[3] as Difficulty | undefined;
const difficulties: Difficulty[] = only
  ? [only]
  : ["easy", "realistic", "brutal"];

const { table, fires, violations, games } = runBatch(seeds, difficulties);
console.log(table);

const ids = EVENTS.map((e) => e.id);
const never = ids.filter((id) => !fires[id]);
const perGame = (id: string) => ((fires[id] ?? 0) / games).toFixed(2);
console.log(`\nGames: ${games}. Cooldown violations: ${violations.length}`);
if (violations.length) console.log(violations.slice(0, 10).join(", "));
console.log(
  `Events never fired (${never.length}/${ids.length}): ${never.join(", ") || "none"}`,
);
const rare = ids
  .filter((id) => fires[id] && fires[id] / games < 0.2)
  .map((id) => `${id}(${perGame(id)})`);
console.log(`Rare events (<0.2 per game): ${rare.join(", ") || "none"}`);
const common = ids
  .filter((id) => fires[id] / games > 3)
  .map((id) => `${id}(${perGame(id)})`);
console.log(`Frequent events (>3 per game): ${common.join(", ") || "none"}`);
