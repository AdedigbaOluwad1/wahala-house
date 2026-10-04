import { lazy, Suspense, useEffect, useState } from "react";
import type { GameConfig } from "../engine/state";
import type { SaveData } from "../persistence/saveFormat";
import { useSettings } from "../store/settingsStore";
import type { FlowEntry } from "./screens/GameFlow";
import { SetupScreen } from "./screens/SetupScreen";
import { TitleScreen } from "./screens/TitleScreen";
import { Toaster } from "@/components/ui/sonner";

type Screen = "title" | "setup" | "play";

const GameFlow = lazy(() =>
  import("./screens/GameFlow").then((m) => ({ default: m.GameFlow })),
);

export function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [entry, setEntry] = useState<FlowEntry | null>(null);
  const hydrate = useSettings((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const start = (config: GameConfig) => {
    setEntry({ kind: "new", config });
    setScreen("play");
  };
  const loadData = (data: SaveData) => {
    setEntry({ kind: "save", data });
    setScreen("play");
  };

  return (
    <>
      <main className="min-h-dvh bg-background text-foreground">
        {screen === "title" && (
          <TitleScreen
            onStart={() => setScreen("setup")}
            onLoadData={loadData}
          />
        )}
        {screen === "setup" && (
          <SetupScreen onStart={start} onBack={() => setScreen("title")} />
        )}
        <Suspense fallback={null}>
          {screen === "play" && entry && (
            <GameFlow
              entry={entry}
              onExit={() => setScreen("title")}
              onAgain={() => setScreen("setup")}
            />
          )}
        </Suspense>
      </main>
      <Toaster position="top-center" />
    </>
  );
}
