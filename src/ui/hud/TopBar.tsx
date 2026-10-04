import {
  Banknote,
  Gavel,
  Landmark,
  Pause,
  Play,
  ShieldCheck,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { TICKS_PER_QUARTER, gameDate } from "../../engine";
import type { GameState } from "../../engine";
import { strings } from "../../content/strings/en";
import { useGame } from "../../store/gameStore";
import { Button } from "@/components/ui/button";
import { MeterCard } from "@/components/game/MeterCard";

import { formatMoney } from "../format";

const SPEEDS = ["slow", "normal", "fast"] as const;

export function TopBar({ game }: { game: GameState }) {
  const playing = useGame((s) => s.playing);
  const speed = useGame((s) => s.speed);
  const setPlaying = useGame((s) => s.setPlaying);
  const setSpeed = useGame((s) => s.setSpeed);
  const n = game.national;
  const d = gameDate(game.tick);
  const m = strings.meters;
  const blocked = game.budgetWindowOpen || game.status.kind !== "running";
  const quarterProgress = ((d.week - 1) / TICKS_PER_QUARTER) * 100;

  return (
    <header className="border-b border-white/10 bg-background/95 p-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        <MeterCard
          label={m.treasury}
          icon={Landmark}
          value={formatMoney(n.treasury)}
          tone={n.treasury < 200 ? "bad" : "default"}
        />
        <MeterCard
          label={m.inflation}
          icon={TrendingUp}
          value={`${n.inflation.toFixed(1)}%`}
          tone={n.inflation > 25 ? "bad" : "default"}
        />
        <MeterCard
          label={m.naira}
          icon={Banknote}
          value={`${Math.round(n.nairaStrength)}`}
          fill={n.nairaStrength}
        />
        <MeterCard
          label={m.approval}
          icon={ThumbsUp}
          value={`${Math.round(n.approval)}%`}
          fill={n.approval}
          tone={n.approval < 30 ? "bad" : "default"}
        />
        <MeterCard
          label={m.stability}
          icon={ShieldCheck}
          value={`${Math.round(n.stability)}`}
          fill={n.stability}
          tone={n.stability < 35 ? "bad" : "default"}
        />
        <MeterCard
          label={m.assembly}
          icon={Gavel}
          value={`${Math.round(n.assemblySupport)}`}
          fill={n.assemblySupport}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-extrabold">
            {strings.dateLine(d.year, d.quarter, d.week)}
          </div>
          <div
            className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-black/40"
            aria-hidden="true"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${quarterProgress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={strings.speedLabel}
            className="flex gap-1"
          >
            {SPEEDS.map((s) => (
              <Button
                key={s}
                variant="secondary"
                size="sm"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
              >
                {strings.speed[s]}
              </Button>
            ))}
          </div>
          <Button
            size="lg"
            disabled={blocked}
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? strings.pause : strings.play}
          >
            {playing ? (
              <Pause className="size-5" />
            ) : (
              <Play className="size-5" />
            )}
            <span className="hidden sm:inline">
              {playing ? strings.pause : strings.play}
            </span>
            <span className="sm:hidden sr-only">
              {playing ? strings.pause : strings.play}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
