import { strings } from '../../content/strings/en';
import { useGame } from '../../store/gameStore';
import { MetricPicker } from '../hud/MetricPicker';
import { TopBar } from '../hud/TopBar';
import { MapView } from '../map/MapView';
import { QuarterPrompt } from '../modals/QuarterPrompt';
import { StatePanel } from '../panels/StatePanel';
import { useGameLoop } from '../useGameLoop';

export function GameScreen({ onExit }: { onExit: () => void }) {
  useGameLoop();
  useGame((s) => s.rev);
  const game = useGame((s) => s.game);
  const metric = useGame((s) => s.metric);
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const confirmBudget = useGame((s) => s.confirmBudget);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar game={game} />
      <div className="flex items-center justify-between gap-2 bg-emerald-950">
        <MetricPicker />
        <div className="flex items-center gap-2 px-2">
          <label htmlFor="jump" className="sr-only">{strings.jumpToState}</label>
          <select
            id="jump"
            className="h-10 max-w-40 rounded bg-black/40 px-2 text-sm"
            value={selected ?? ''}
            onChange={(e) => select(e.target.value || null)}
          >
            <option value="">{strings.jumpToState}</option>
            {[...game.states].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className="h-10 whitespace-nowrap text-sm underline" onClick={onExit}>{strings.back}</button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[1fr_20rem]">
        <div className="min-h-0 min-w-0 flex-1 bg-emerald-950">
          <MapView game={game} metric={metric} selected={selected} onSelect={select} />
        </div>
        <aside
          className={`bg-emerald-900 lg:static lg:block lg:max-h-none lg:overflow-y-auto ${
            selected ? 'fixed inset-x-0 bottom-0 z-10 max-h-[45dvh] overflow-y-auto rounded-t-xl shadow-2xl' : 'hidden'
          }`}
          aria-label="State details"
        >
          <StatePanel game={game} stateId={selected} onClose={() => select(null)} />
        </aside>
      </div>
      {game.budgetWindowOpen && <QuarterPrompt onConfirm={confirmBudget} />}
    </div>
  );
}
