import { useState } from 'react';
import { TitleScreen } from './screens/TitleScreen';
import { GameScreen } from './screens/GameScreen';
import { strings } from '../content/strings/en';

export function App() {
  const [playing, setPlaying] = useState(false);
  return (
    <main className="min-h-screen bg-emerald-950 text-white">
      {playing ? <GameScreen onExit={() => setPlaying(false)} /> : <TitleScreen onStart={() => setPlaying(true)} />}
      <span className="sr-only">{strings.appName}</span>
    </main>
  );
}
