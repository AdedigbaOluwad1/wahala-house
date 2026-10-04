import { useEffect, useState } from "react";
import {
  FolderOpen,
  Info,
  Landmark,
  Play,
  Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";
import { strings } from "../../content/strings/en";
import { listSaves, loadSlot } from "../../persistence/db";
import { Button } from "@/components/ui/button";
import type { SaveData } from "../../persistence/saveFormat";
import { SystemDialog, describeSummary } from "../modals/SystemDialog";
import type { SystemView } from "../modals/SystemDialog";

export function TitleScreen({
  onStart,
  onLoadData,
}: {
  onStart: () => void;
  onLoadData: (data: SaveData) => void;
}) {
  const [autoSummary, setAutoSummary] = useState<string | null>(null);
  const [view, setView] = useState<SystemView | null>(null);

  useEffect(() => {
    let live = true;
    listSaves()
      .then((rows) => {
        const auto = rows.find((r) => r.slot === "auto");
        if (live) setAutoSummary(auto ? describeSummary(auto.summary) : null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="grid size-24 place-items-center rounded-3xl border-b-8 border-black/30 bg-primary text-primary-foreground shadow-xl">
        <Landmark className="size-12" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-5xl font-black tracking-tight">
          {strings.appName}
        </h1>
        <p className="mt-2 text-muted-foreground">{strings.tagline}</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {autoSummary && (
          <Button
            size="lg"
            variant="success"
            className="h-auto w-full flex-col gap-0 py-2 text-lg"
            onClick={async () => {
              const data = await loadSlot("auto");
              if (!data) {
                toast.error(strings.system.errors.invalid_state);
                return;
              }
              onLoadData(data);
            }}
          >
            <span className="flex items-center gap-2">
              <Play />
              {strings.system.continueGame}
            </span>
            <span className="text-xs font-semibold opacity-80">
              {autoSummary}
            </span>
          </Button>
        )}
        <Button size="lg" className="w-full text-lg" onClick={onStart}>
          {strings.start}
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={() => setView("load")}>
            <FolderOpen />
            {strings.system.load}
          </Button>
          <Button variant="secondary" onClick={() => setView("settings")}>
            <SettingsIcon />
            {strings.system.settings}
          </Button>
          <Button variant="secondary" onClick={() => setView("about")}>
            <Info />
            {strings.system.aboutShort}
          </Button>
        </div>
      </div>
      <SystemDialog
        open={view !== null}
        view={view ?? "about"}
        onView={setView}
        inGame={false}
        onClose={() => setView(null)}
        onLoadData={onLoadData}
      />
    </section>
  );
}
