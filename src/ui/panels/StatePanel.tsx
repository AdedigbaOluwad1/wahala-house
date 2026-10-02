import type { GameState } from '../../engine';
import { SECTORS } from '../../engine';
import { strings } from '../../content/strings/en';
import { scaleColor } from '../map/colors';

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded bg-black/40" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-2 rounded" style={{ width: `${value}%`, background: scaleColor(value) }} />
      </div>
    </div>
  );
}

export function StatePanel({ game, stateId, onClose }: { game: GameState; stateId: string | null; onClose: () => void }) {
  const s = game.states.find((x) => x.id === stateId);
  if (!s) return <p className="p-4 text-sm text-emerald-100">{strings.noSelection}</p>;
  return (
    <div className="flex flex-col gap-2 p-3 lg:gap-3 lg:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{s.name}</h2>
          <p className="text-sm text-emerald-100">{strings.zones[s.zone]}</p>
        </div>
        <button className="h-10 rounded bg-black/30 px-3 text-sm lg:hidden" onClick={onClose}>{strings.closePanel}</button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-emerald-200">{strings.population}</dt>
        <dd>{(s.population / 1e6).toFixed(1)}m</dd>
        <dt className="text-emerald-200">{strings.governor}</dt>
        <dd>{s.governor}</dd>
        <dt className="text-emerald-200">{strings.traitsLabel}</dt>
        <dd>{s.traits.map((t) => strings.traits[t]).join(', ')}</dd>
      </dl>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-1">
        <Bar label={strings.metrics.mood} value={s.mood} />
        {SECTORS.map((k) => <Bar key={k} label={strings.metrics[k]} value={s[k]} />)}
      </div>
    </div>
  );
}
