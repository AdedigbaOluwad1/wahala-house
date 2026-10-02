import { gameDate } from '../../engine';
import type { GameState } from '../../engine';
import { strings } from '../../content/strings/en';
import { useGame } from '../../store/gameStore';

const SPEEDS = ['slow', 'normal', 'fast'] as const;

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded bg-black/30 px-2 py-1">
      <div className="truncate text-[11px] uppercase tracking-wide text-emerald-200">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function TopBar({ game }: { game: GameState }) {
  const playing = useGame((s) => s.playing);
  const speed = useGame((s) => s.speed);
  const setPlaying = useGame((s) => s.setPlaying);
  const setSpeed = useGame((s) => s.setSpeed);
  const n = game.national;
  const d = gameDate(game.tick);
  const m = strings.meters;
  const blocked = game.budgetWindowOpen || game.status.kind !== 'running';

  return (
    <header className="bg-emerald-900 p-2 text-sm">
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
        <Meter label={m.treasury} value={`₦${Math.round(n.treasury).toLocaleString()}bn`} />
        <Meter label={m.inflation} value={`${n.inflation.toFixed(1)}%`} />
        <Meter label={m.naira} value={`${Math.round(n.nairaStrength)}`} />
        <Meter label={m.approval} value={`${Math.round(n.approval)}%`} />
        <Meter label={m.stability} value={`${Math.round(n.stability)}`} />
        <Meter label={m.assembly} value={`${Math.round(n.assemblySupport)}`} />
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm" aria-live="off">{strings.dateLine(d.year, d.quarter, d.week)}</span>
        <div className="flex items-center gap-2">
          <button
            className="h-10 min-w-20 rounded bg-white px-3 font-semibold text-emerald-950 disabled:opacity-50"
            disabled={blocked}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? strings.pause : strings.play}
          </button>
          <div role="group" aria-label={strings.speedLabel} className="flex overflow-hidden rounded">
            {SPEEDS.map((s) => (
              <button
                key={s}
                aria-pressed={speed === s}
                className={`h-10 px-3 text-sm ${speed === s ? 'bg-emerald-300 text-emerald-950' : 'bg-black/30'}`}
                onClick={() => setSpeed(s)}
              >
                {strings.speed[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
