import { useEffect } from "react";
import { secondsPerTick } from "../engine";
import { useGame } from "../store/gameStore";

export function useGameLoop() {
  const playing = useGame((s) => s.playing);
  const speed = useGame((s) => s.speed);
  const advance = useGame((s) => s.advance);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(advance, secondsPerTick(speed) * 1000);
    return () => clearInterval(id);
  }, [playing, speed, advance]);
}
