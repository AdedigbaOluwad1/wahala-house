import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  FolderOpen,
  Info,
  LogOut,
  Play,
  Save,
  Settings as SettingsIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import pkg from "../../../package.json";
import { gameDate } from "../../engine/clock";
import { strings } from "../../content/strings/en";
import {
  SLOTS,
  deleteEverything,
  deleteSlot,
  listSaves,
  loadSlot,
} from "../../persistence/db";
import type { Slot } from "../../persistence/db";
import {
  SaveError,
  parseSaveText,
  serializeSave,
} from "../../persistence/saveFormat";
import type { SaveData, SaveSummary } from "../../persistence/saveFormat";
import { useSettings } from "../../store/settingsStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const S = strings.system;

export type SystemView = "menu" | "save" | "load" | "settings" | "about";

function errorMessage(e: unknown): string {
  return e instanceof SaveError ? S.errors[e.code] : S.errors.unknown;
}

export function downloadSave(data: SaveData): void {
  const blob = new Blob([serializeSave(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wahala-house-save-week-${data.state.tick}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readSaveFile(file: File): Promise<SaveData> {
  return parseSaveText(await file.text());
}

export function describeSummary(sm: SaveSummary): string {
  const d = gameDate(sm.tick);
  return S.summary(
    d.year,
    d.quarter,
    sm.term,
    S.modeNames[sm.mode],
    S.difficultyNames[sm.difficulty],
    Math.round(sm.approval),
  );
}

function SlotsView({
  mode,
  saveTo,
  onLoadData,
  onDone,
}: {
  mode: "save" | "load";
  saveTo?: (slot: Slot) => Promise<void>;
  onLoadData: (data: SaveData) => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<
    { slot: Slot; summary: SaveSummary }[] | null
  >(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    listSaves()
      .then((r) => {
        if (live) setRows(r);
      })
      .catch(() => {
        if (live) setRows([]);
      });
    return () => {
      live = false;
    };
  }, [version]);

  const slots = mode === "save" ? SLOTS.filter((x) => x !== "auto") : SLOTS;

  return (
    <ul className="flex flex-col gap-2">
      {slots.map((slot) => {
        const row = rows?.find((r) => r.slot === slot);
        return (
          <li
            key={slot}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-card p-3"
          >
            <div className="min-w-0">
              <div className="font-extrabold">{S.slots[slot]}</div>
              <div className="text-xs text-muted-foreground">
                {row
                  ? describeSummary(row.summary)
                  : rows === null
                    ? ""
                    : S.empty}
              </div>
              {row && (
                <div className="text-xs text-muted-foreground">
                  {S.savedAt(new Date(row.summary.savedAt).toLocaleString())}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {mode === "save" ? (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await saveTo?.(slot);
                      toast.success(S.saved(S.slots[slot]));
                      setVersion((v) => v + 1);
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  <Save />
                  {row ? S.overwrite : S.save}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!row}
                  onClick={async () => {
                    try {
                      const data = await loadSlot(slot);
                      if (!data) {
                        toast.error(S.errors.invalid_state);
                        return;
                      }
                      onLoadData(data);
                      toast.success(S.loaded);
                      onDone();
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  <FolderOpen />
                  {S.load}
                </Button>
              )}
              {row && slot !== "auto" && (
                <Button
                  size="icon"
                  variant="secondary"
                  aria-label={`${S.delete} ${S.slots[slot]}`}
                  onClick={async () => {
                    await deleteSlot(slot);
                    toast.success(S.deleted);
                    setVersion((v) => v + 1);
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SettingsView() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [confirm, setConfirm] = useState(false);
  const opts = <T extends string>(
    label: string,
    value: T,
    options: { value: T; label: string }[],
    onChange: (v: T) => void,
  ) => (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-3">
      <div className="font-extrabold">{label}</div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.value}
            variant="secondary"
            size="sm"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-card p-3">
        <span>
          <span className="block font-extrabold">{S.autosave}</span>
          <span className="block text-xs text-muted-foreground">
            {S.autosaveHelp}
          </span>
        </span>
        <Switch
          checked={settings.autosave}
          onCheckedChange={(c) => update({ autosave: c })}
          aria-label={S.autosave}
        />
      </label>
      {opts(
        S.reduceMotion,
        settings.reduceMotion,
        (["system", "on", "off"] as const).map((v) => ({
          value: v,
          label: S.reduceMotionOptions[v],
        })),
        (v) => update({ reduceMotion: v }),
      )}
      {opts(
        S.defaultTone,
        settings.tone,
        [
          { value: "dry", label: strings.news.dry },
          { value: "wahala", label: strings.news.wahala },
        ],
        (v) => update({ tone: v }),
      )}
      {opts(
        S.defaultSpeed,
        settings.speed,
        (["slow", "normal", "fast"] as const).map((v) => ({
          value: v,
          label: strings.speed[v],
        })),
        (v) => update({ speed: v }),
      )}
      <Button
        variant={confirm ? "destructive" : "secondary"}
        onClick={async () => {
          if (!confirm) {
            setConfirm(true);
            return;
          }
          await deleteEverything();
          useSettings
            .getState()
            .replace({
              ...settings,
              autosave: true,
              reduceMotion: "system",
              tone: "wahala",
              speed: "normal",
            });
          setConfirm(false);
          toast.success(S.cleared);
        }}
      >
        <Trash2 />
        {confirm ? S.clearConfirm : S.clearData}
      </Button>
    </div>
  );
}

function AboutView() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>{S.aboutBody}</p>
      <p className="text-muted-foreground">{S.aboutFiction}</p>
      <p>{S.aboutMap}</p>
      <p className="text-muted-foreground">{S.aboutData}</p>
      <p className="text-xs text-muted-foreground">
        {S.aboutVersion(pkg.version)}
      </p>
    </div>
  );
}

export function SystemDialog({
  open,
  view,
  onView,
  inGame,
  onClose,
  onLoadData,
  currentSave,
  saveTo,
  onQuit,
}: {
  open: boolean;
  view: SystemView;
  onView: (v: SystemView) => void;
  inGame: boolean;
  onClose: () => void;
  onLoadData: (data: SaveData) => void;
  currentSave?: () => SaveData;
  saveTo?: (slot: Slot) => Promise<void>;
  onQuit?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const titles: Record<SystemView, string> = {
    menu: S.menu,
    save: S.saveGame,
    load: S.loadGame,
    settings: S.settingsTitle,
    about: S.aboutTitle,
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onLoadData(await readSaveFile(file));
      toast.success(S.imported);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {view !== "menu" && inGame && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onView("menu")}
                aria-label={S.back}
              >
                <ArrowLeft />
              </Button>
            )}
            {titles[view]}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {titles[view]}
          </DialogDescription>
        </DialogHeader>
        {view === "menu" && (
          <div className="flex flex-col gap-2">
            <Button size="lg" variant="success" onClick={onClose}>
              <Play />
              {S.resume}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onView("save")}
            >
              <Save />
              {S.saveGame}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onView("load")}
            >
              <FolderOpen />
              {S.loadGame}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                if (currentSave) {
                  downloadSave(currentSave());
                  toast.success(S.exported);
                }
              }}
            >
              <Download />
              {S.exportSave}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
              {S.importSave}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onView("settings")}
            >
              <SettingsIcon />
              {S.settings}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => onView("about")}
            >
              <Info />
              {S.about}
            </Button>
            <Button size="lg" variant="ghost" onClick={onQuit}>
              <LogOut />
              {S.quit}
            </Button>
          </div>
        )}
        {(view === "save" || view === "load") && (
          <SlotsView
            mode={view}
            saveTo={saveTo}
            onLoadData={onLoadData}
            onDone={onClose}
          />
        )}
        {view === "settings" && <SettingsView />}
        {view === "about" && <AboutView />}
        {view === "load" && !inGame && (
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload />
            {S.importSave}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label={S.importSave}
          tabIndex={-1}
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
