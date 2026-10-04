import { create } from "zustand";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "../persistence/db";
import type { Settings } from "../persistence/db";

interface SettingsStore {
  settings: Settings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  replace: (settings: Settings) => void;
}

export function applyMotionPreference(pref: Settings["reduceMotion"]): void {
  const root = document.documentElement;
  root.classList.toggle("reduce-motion", pref === "on");
  root.classList.toggle("allow-motion", pref === "off");
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    try {
      const settings = await loadSettings();
      applyMotionPreference(settings.reduceMotion);
      set({ settings, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  update: (patch) => {
    const settings = { ...get().settings, ...patch };
    applyMotionPreference(settings.reduceMotion);
    set({ settings });
    void saveSettings(settings).catch(() => undefined);
  },
  replace: (settings) => {
    applyMotionPreference(settings.reduceMotion);
    set({ settings });
  },
}));
