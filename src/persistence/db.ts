import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { SaveError, summarize, validateSave } from './saveFormat';
import type { SaveData, SaveSummary } from './saveFormat';

export const SLOTS = ['auto', 'slot-1', 'slot-2', 'slot-3'] as const;
export type Slot = (typeof SLOTS)[number];

export interface Settings {
  autosave: boolean;
  reduceMotion: 'system' | 'on' | 'off';
  tone: 'dry' | 'wahala';
  speed: 'slow' | 'normal' | 'fast';
}

export const DEFAULT_SETTINGS: Settings = { autosave: true, reduceMotion: 'system', tone: 'wahala', speed: 'normal' };

interface SaveRecord {
  slot: Slot;
  summary: SaveSummary;
  data: SaveData;
}

interface Schema extends DBSchema {
  saves: { key: Slot; value: SaveRecord };
  settings: { key: string; value: Settings };
}

const DB_NAME = 'wahala-house';
let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('saves', { keyPath: 'slot' });
      d.createObjectStore('settings');
    },
  });
  return dbPromise;
}

export async function resetConnection(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export async function saveToSlot(slot: Slot, data: SaveData): Promise<void> {
  await (await db()).put('saves', { slot, summary: summarize(data), data });
}

export async function loadSlot(slot: Slot): Promise<SaveData | null> {
  const record = await (await db()).get('saves', slot);
  if (!record) return null;
  try {
    return validateSave(record.data);
  } catch (e) {
    if (e instanceof SaveError) return null;
    throw e;
  }
}

export async function listSaves(): Promise<{ slot: Slot; summary: SaveSummary }[]> {
  const all = await (await db()).getAll('saves');
  return all.map((r) => ({ slot: r.slot, summary: r.summary }));
}

export async function deleteSlot(slot: Slot): Promise<void> {
  await (await db()).delete('saves', slot);
}

export async function deleteEverything(): Promise<void> {
  const d = await db();
  await d.clear('saves');
  await d.clear('settings');
}

export async function loadSettings(): Promise<Settings> {
  const stored = await (await db()).get('settings', 'main');
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await (await db()).put('settings', settings, 'main');
}
