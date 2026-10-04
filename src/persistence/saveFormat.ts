import type { Action, GameConfig, GameState } from "../engine";

export const SAVE_VERSION = 1;
export const SAVE_FORMAT = "wahala-house-save";

export interface SaveUi {
  tone: "dry" | "wahala";
  speed: GameConfig["speed"];
  metric: string;
}

export interface SaveData {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: number;
  config: GameConfig;
  seed: string;
  state: GameState;
  actions: Action[];
  ui: SaveUi;
}

export interface SaveSummary {
  savedAt: number;
  tick: number;
  term: number;
  mode: GameConfig["mode"];
  difficulty: GameConfig["difficulty"];
  approval: number;
  treasury: number;
}

export class SaveError extends Error {
  constructor(
    public code: "not_json" | "wrong_format" | "too_new" | "invalid_state",
    message: string,
  ) {
    super(message);
  }
}

const STATE_KEYS = [
  "config",
  "seed",
  "rngState",
  "tick",
  "states",
  "national",
  "budget",
  "scheduled",
  "ongoing",
  "active",
  "cooldowns",
  "landed",
  "events",
  "news",
  "counters",
  "status",
  "term",
  "termEndTick",
  "elections",
  "timeline",
  "stats",
  "startStats",
];

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {};

export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let data = raw;
  let version = typeof data.version === "number" ? data.version : 0;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step)
      throw new SaveError(
        "invalid_state",
        `No migration from save version ${version}`,
      );
    data = step(data);
    version = typeof data.version === "number" ? data.version : version + 1;
  }
  return data;
}

export function validateSave(raw: unknown): SaveData {
  if (!raw || typeof raw !== "object")
    throw new SaveError("wrong_format", "Not a save file");
  let data = raw as Record<string, unknown>;
  if (data.format !== SAVE_FORMAT)
    throw new SaveError("wrong_format", "Not a Wahala House save file");
  if (typeof data.version !== "number")
    throw new SaveError("wrong_format", "Missing save version");
  if (data.version > SAVE_VERSION)
    throw new SaveError(
      "too_new",
      "This save was made by a newer version of the game",
    );
  data = migrate(data);

  const state = data.state as Record<string, unknown> | undefined;
  if (!state || typeof state !== "object")
    throw new SaveError("invalid_state", "Missing game state");
  for (const k of STATE_KEYS)
    if (!(k in state))
      throw new SaveError("invalid_state", `Game state is missing ${k}`);
  if (!Array.isArray(state.states) || state.states.length !== 37)
    throw new SaveError(
      "invalid_state",
      "Game state has the wrong number of states",
    );
  if (typeof state.rngState !== "number" || typeof state.tick !== "number")
    throw new SaveError("invalid_state", "Game state is corrupt");
  if (!Array.isArray(data.actions))
    throw new SaveError("invalid_state", "Missing action log");
  if (!data.config || typeof data.config !== "object")
    throw new SaveError("invalid_state", "Missing configuration");
  return data as unknown as SaveData;
}

export function parseSaveText(text: string): SaveData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError("not_json", "That file is not valid JSON");
  }
  return validateSave(raw);
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify(data);
}

export function summarize(data: SaveData): SaveSummary {
  return {
    savedAt: data.savedAt,
    tick: data.state.tick,
    term: data.state.term,
    mode: data.config.mode,
    difficulty: data.config.difficulty,
    approval: data.state.national.approval,
    treasury: data.state.national.treasury,
  };
}

export function buildSave(
  game: GameState,
  actions: Action[],
  ui: SaveUi,
): SaveData {
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: Date.now(),
    config: game.config,
    seed: game.seed,
    state: JSON.parse(JSON.stringify(game)) as GameState,
    actions: JSON.parse(JSON.stringify(actions)) as Action[],
    ui,
  };
}
