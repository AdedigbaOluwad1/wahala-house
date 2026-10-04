import { describe, expect, it } from "vitest";
import { BOTS } from "../sim/bots";
import { playOne } from "../sim/run";
import type { GameConfig } from "../src/engine";

const config = (seed: string): GameConfig => ({
  mode: "term",
  termYears: 4,
  termsAllowed: 2,
  difficulty: "realistic",
  speed: "fast",
  tone: "dry",
  language: "en",
  seed,
});

describe("bot harness", () => {
  it("is deterministic for a bot and seed", () => {
    const a = playOne(BOTS[1], config("det"));
    const b = playOne(BOTS[1], config("det"));
    expect(a).toEqual(b);
  });

  it("every bot finishes a game without breaking the cooldown invariant", () => {
    for (const bot of BOTS) {
      for (const seed of ["a", "b"]) {
        const r = playOne(bot, config(`${bot.name}-${seed}`));
        expect(r.outcome).not.toBe("ongoing");
        expect(r.cooldownViolations).toEqual([]);
      }
    }
  });
});
