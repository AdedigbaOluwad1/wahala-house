import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  defaultBudget,
  enactPolicy,
  newGame,
  replay,
  setBudget,
  stepTick,
} from "../src/engine";
import type { Action, GameConfig, GameState } from "../src/engine";
import {
  DEFAULT_SETTINGS,
  SLOTS,
  deleteEverything,
  deleteSlot,
  listSaves,
  loadSettings,
  loadSlot,
  saveSettings,
  saveToSlot,
} from "../src/persistence/db";
import {
  SAVE_FORMAT,
  SAVE_VERSION,
  SaveError,
  buildSave,
  parseSaveText,
  serializeSave,
  validateSave,
} from "../src/persistence/saveFormat";

const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({
  ...DEFAULT_CONFIG,
  seed: "persist",
  ...over,
});
const ui = { tone: "wahala", speed: "normal", metric: "mood" } as const;

function play(g: GameState, ticks: number) {
  for (let i = 0; i < ticks && g.status.kind === "running"; i++) {
    g.budgetWindowOpen = false;
    g.events.active = g.events.active.filter((a) => a.severity !== 3);
    stepTick(g);
  }
}

beforeEach(async () => {
  await deleteEverything();
});

describe("save format", () => {
  it("round-trips through JSON without losing anything", () => {
    const g = newGame(cfg());
    play(g, 80);
    const save = buildSave(g, [], ui);
    const parsed = parseSaveText(serializeSave(save));
    expect(JSON.stringify(parsed.state)).toBe(JSON.stringify(g));
    expect(parsed.version).toBe(SAVE_VERSION);
  });

  it("a restored game continues exactly like the original", () => {
    const original = newGame(cfg());
    play(original, 70);
    const restored = parseSaveText(
      serializeSave(buildSave(original, [], ui)),
    ).state;
    play(original, 90);
    play(restored, 90);
    expect(JSON.stringify(restored)).toBe(JSON.stringify(original));
  });

  it("keeps the action log so a save can be replayed", () => {
    const actions: Action[] = [
      { tick: 0, type: "setBudget", budget: defaultBudget() },
      { tick: 5, type: "enactPolicy", policyId: "cash_transfer" },
    ];
    const g = replay(cfg(), actions, 40);
    const save = parseSaveText(serializeSave(buildSave(g, actions, ui)));
    expect(save.actions).toEqual(actions);
    const again = replay(save.config, save.actions, 40);
    expect(JSON.stringify(again)).toBe(JSON.stringify(g));
  });

  it("rejects files that are not saves", () => {
    expect(() => parseSaveText("not json")).toThrowError(SaveError);
    expect(() => parseSaveText('{"hello":1}')).toThrowError(
      /Not a Wahala House save/,
    );
    expect(() => validateSave(null)).toThrowError(SaveError);
  });

  it("rejects saves from the future and corrupt states", () => {
    const good = buildSave(newGame(cfg()), [], ui);
    expect(() =>
      validateSave({ ...good, version: SAVE_VERSION + 1 }),
    ).toThrowError(/newer version/);
    expect(() =>
      validateSave({ ...good, state: { ...good.state, states: [] } }),
    ).toThrowError(/wrong number of states/);
    const broken = { ...good, state: { ...good.state } } as unknown as {
      state: Record<string, unknown>;
    };
    delete broken.state.national;
    expect(() => validateSave(broken)).toThrowError(/missing national/);
    expect(() => validateSave({ ...good, format: "other" })).toThrowError(
      SaveError,
    );
  });

  it("flags saves with no migration path instead of loading them blindly", () => {
    const good = buildSave(newGame(cfg()), [], ui);
    expect(() => validateSave({ ...good, version: 0 })).toThrowError(
      /No migration/,
    );
    expect(good.format).toBe(SAVE_FORMAT);
  });
});

describe("save slots", () => {
  it("stores, lists, loads and deletes saves", async () => {
    const g = newGame(cfg());
    play(g, 30);
    await saveToSlot("slot-1", buildSave(g, [], ui));
    await saveToSlot("auto", buildSave(g, [], ui));
    const list = await listSaves();
    expect(list.map((x) => x.slot).sort()).toEqual(["auto", "slot-1"]);
    expect(list[0].summary.tick).toBe(30);
    const loaded = await loadSlot("slot-1");
    expect(JSON.stringify(loaded?.state)).toBe(JSON.stringify(g));
    await deleteSlot("slot-1");
    expect(await loadSlot("slot-1")).toBeNull();
    expect(SLOTS).toContain("auto");
  });

  it("overwrites a slot and skips corrupt records", async () => {
    const g = newGame(cfg());
    await saveToSlot("slot-2", buildSave(g, [], ui));
    play(g, 10);
    await saveToSlot("slot-2", buildSave(g, [], ui));
    expect((await loadSlot("slot-2"))?.state.tick).toBe(10);
  });
});

describe("settings", () => {
  it("defaults, saves and reloads", async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSettings({ ...DEFAULT_SETTINGS, autosave: false, tone: "dry" });
    expect(await loadSettings()).toMatchObject({
      autosave: false,
      tone: "dry",
    });
  });
});

describe("policies survive a save", () => {
  it("keeps pending effects and active policies", () => {
    const g = newGame(cfg());
    g.national.treasury = 5000;
    g.national.assemblySupport = 100;
    setBudget(g, defaultBudget());
    enactPolicy(g, "recruit_police");
    play(g, 5);
    const restored = parseSaveText(serializeSave(buildSave(g, [], ui))).state;
    expect(restored.scheduled.length).toBe(g.scheduled.length);
    expect(restored.active).toEqual(g.active);
    play(g, 20);
    play(restored, 20);
    expect(JSON.stringify(restored)).toBe(JSON.stringify(g));
  });
});
