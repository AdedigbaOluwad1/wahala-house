import { useState } from 'react';
import type { GameConfig } from '../engine';
import { useGame } from '../store/gameStore';
import { GameScreen } from './screens/GameScreen';
import { LegacyScreen } from './screens/LegacyScreen';
import { SetupScreen } from './screens/SetupScreen';
import { TitleScreen } from './screens/TitleScreen';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

type Screen = 'title' | 'setup' | 'game' | 'legacy';

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const newGame = useGame((s) => s.newGame);
  const game = useGame((s) => s.game);

  const start = (config: GameConfig) => {
    newGame(config);
    setScreen('game');
  };

  return (
    <TooltipProvider>
      <main className="min-h-dvh bg-background text-foreground">
        {screen === 'title' && <TitleScreen onStart={() => setScreen('setup')} />}
        {screen === 'setup' && <SetupScreen onStart={start} onBack={() => setScreen('title')} />}
        {screen === 'game' && <GameScreen onExit={() => setScreen('title')} onFinished={() => setScreen('legacy')} />}
        {screen === 'legacy' && <LegacyScreen game={game} onAgain={() => setScreen('setup')} onTitle={() => setScreen('title')} />}
      </main>
      <Toaster position="top-center" />
    </TooltipProvider>
  );
}
