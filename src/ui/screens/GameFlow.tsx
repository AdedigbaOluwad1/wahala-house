import { useEffect, useRef, useState } from 'react';
import type { GameConfig } from '../../engine/state';
import type { SaveData } from '../../persistence/saveFormat';
import { useGame } from '../../store/gameStore';
import { useSettings } from '../../store/settingsStore';
import { GameScreen } from './GameScreen';
import { LegacyScreen } from './LegacyScreen';

export type FlowEntry = { kind: 'new'; config: GameConfig } | { kind: 'save'; data: SaveData };

export function GameFlow({ entry, onExit, onAgain }: { entry: FlowEntry; onExit: () => void; onAgain: () => void }) {
  const [ready, setReady] = useState(false);
  const [ended, setEnded] = useState(false);
  const applied = useRef<FlowEntry | null>(null);
  const game = useGame((s) => s.game);
  const autosave = useSettings((s) => s.settings.autosave);

  useEffect(() => {
    if (applied.current === entry) return;
    applied.current = entry;
    const store = useGame.getState();
    if (entry.kind === 'new') store.newGame(entry.config);
    else store.loadSave(entry.data);
    setEnded(false);
    setReady(true);
  }, [entry]);

  useEffect(() => {
    if (!ready || ended || !autosave) return;
    const flush = () => {
      const g = useGame.getState().game;
      if (g.status.kind === 'removed' || g.status.kind === 'finished') return;
      void useGame.getState().saveTo('auto').catch(() => undefined);
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [ready, ended, autosave]);

  if (!ready) return null;
  if (ended) return <LegacyScreen game={game} onAgain={onAgain} onTitle={onExit} />;
  return <GameScreen onExit={onExit} onFinished={() => setEnded(true)} />;
}
