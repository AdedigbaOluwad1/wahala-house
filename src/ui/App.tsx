import { useState } from 'react';
import { TitleScreen } from './screens/TitleScreen';
import { GameScreen } from './screens/GameScreen';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export function App() {
  const [playing, setPlaying] = useState(false);
  return (
    <TooltipProvider>
      <main className="min-h-dvh bg-background text-foreground">
        {playing ? <GameScreen onExit={() => setPlaying(false)} /> : <TitleScreen onStart={() => setPlaying(true)} />}
      </main>
      <Toaster position="top-center" />
    </TooltipProvider>
  );
}
