import { useMemo, useState } from 'react';
import { Award, Download, RotateCcw, Share2 } from 'lucide-react';
import { SECTORS, buildLegacy, getEvent, getPolicy } from '../../engine';
import type { GameState, TimelineEntry } from '../../engine';
import { strings } from '../../content/strings/en';
import { METRIC_ICONS } from '../icons';
import { formatMoney } from '../format';
import { renderShareCard, tradeoffText } from '../shareCard';
import { StatBar } from '@/components/game/StatBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const L = strings.legacy;

function timelineText(game: GameState, e: TimelineEntry): string {
  const state = e.stateId ? game.states.find((s) => s.id === e.stateId)?.name ?? '' : '';
  switch (e.type) {
    case 'policy': return L.policyEnacted(getPolicy(e.refId!)?.name ?? e.refId!);
    case 'policy_failed': return L.policyFailed(getPolicy(e.refId!)?.name ?? e.refId!);
    case 'event': {
      const title = (getEvent(e.refId!)?.title ?? e.refId!).replace(/\{state\}/g, state);
      return e.ignored ? L.eventIgnored(title) : L.eventResponded(title);
    }
    case 'election': return e.won ? L.electionWon : L.electionLost;
    case 'ended': return L.ended;
  }
}

export function LegacyScreen({ game, onAgain, onTitle }: { game: GameState; onAgain: () => void; onTitle: () => void }) {
  const legacy = useMemo(() => buildLegacy(game), [game]);
  const [busy, setBusy] = useState(false);
  const tradeoff = tradeoffText(legacy);

  const exportCard = async (share: boolean) => {
    setBusy(true);
    try {
      const blob = await renderShareCard(legacy);
      const file = new File([blob], 'wahala-house.png', { type: 'image/png' });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: L.shareText(legacy.score, L.outcomes[legacy.outcome]) });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wahala-house.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      return;
    } finally {
      setBusy(false);
    }
  };

  const key = legacy.timeline.filter((t) => t.type !== 'event' || t.ignored !== undefined);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 p-4 pb-10">
      <header className="flex flex-col items-center gap-2 rounded-3xl border-b-8 border-black/30 bg-primary p-6 text-center text-primary-foreground">
        <Award className="size-10" aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-wide">{L.title}</p>
        <h1 className="text-3xl font-black leading-tight">{L.outcomes[legacy.outcome]}</h1>
        <p className="text-sm">{L.outcomeBlurb[legacy.outcome]}</p>
        <div className="mt-2 text-6xl font-black tabular-nums" aria-label={`${L.score} ${legacy.score}`}>{legacy.score}</div>
        <div className="text-xs font-bold uppercase tracking-wide">{L.score}</div>
      </header>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          [L.timeLabel, L.yearsValue(legacy.years)],
          [L.avgApproval, `${Math.round(legacy.avgApproval)}%`],
          [L.avgStability, `${Math.round(legacy.avgStability)}`],
          [L.peakInflation, `${legacy.peakInflation.toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-card p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-extrabold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">{L.elections(legacy.electionsWon, legacy.electionsLost)}</p>

      <div className="rounded-xl border border-white/10 bg-card p-3">
        <h2 className="mb-2 font-extrabold">{L.finalMeters}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span>{strings.meters.treasury}: <b>{formatMoney(legacy.finalMeters.treasury)}</b></span>
          <span>{strings.meters.debt}: <b>{formatMoney(legacy.finalMeters.debt)}</b></span>
          <span>{strings.meters.approval}: <b>{Math.round(legacy.finalMeters.approval)}%</b></span>
          <span>{strings.meters.stability}: <b>{Math.round(legacy.finalMeters.stability)}</b></span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-card p-3">
        <h2 className="mb-2 font-extrabold">{L.changes}</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[...SECTORS, 'mood' as const].map((k) => {
            const c = legacy.changes.find((x) => x.stat === k)!;
            return (
              <div key={k} className="flex flex-col gap-1">
                <StatBar label={strings.metrics[k]} value={c.end} icon={METRIC_ICONS[k]} />
                <span className={cn('text-xs font-bold', Math.abs(c.delta) < 0.05 ? 'text-muted-foreground' : c.delta > 0 ? 'text-success-ink' : 'text-destructive-ink')}>{L.delta(c.delta)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-card p-3">
        <h2 className="mb-1 font-extrabold">{L.traded}</h2>
        {legacy.traded.length === 0 ? <p className="text-sm text-muted-foreground">{L.tradedNone}</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {legacy.traded.map((c) => <li key={c.stat}><b>{strings.metrics[c.stat]}</b> <span className="text-destructive-ink">{L.delta(c.delta)}</span></li>)}
          </ul>
        )}
      </div>

      {tradeoff && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
          <h2 className="mb-1 font-extrabold">{L.tradeoff}</h2>
          <p className="text-sm">{tradeoff}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {[[L.best, legacy.best], [L.worst, legacy.worst]].map(([title, list]) => (
          <div key={title as string} className="rounded-xl border border-white/10 bg-card p-3">
            <h2 className="mb-1 text-sm font-extrabold">{title as string}</h2>
            <ol className="flex flex-col gap-1 text-sm">
              {(list as typeof legacy.best).map((s) => <li key={s.id} className="flex justify-between gap-2"><span>{s.name}</span><b className="tabular-nums">{Math.round(s.mood)}</b></li>)}
            </ol>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-card p-3">
        <h2 className="mb-2 font-extrabold">{L.timeline}</h2>
        {key.length === 0 ? <p className="text-sm text-muted-foreground">{L.timelineEmpty}</p> : (
          <ol tabIndex={0} aria-label={L.timeline} className="flex max-h-72 flex-col gap-1.5 overflow-y-auto text-sm">
            {key.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{L.week(e.tick)}</span>
                <span>{timelineText(game, e)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="flex-1" disabled={busy} onClick={() => exportCard(true)}><Share2 />{L.share}</Button>
        <Button size="lg" variant="secondary" className="flex-1" disabled={busy} onClick={() => exportCard(false)}><Download />{L.download}</Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" variant="success" className="flex-1" onClick={onAgain}><RotateCcw />{L.again}</Button>
        <Button size="lg" variant="ghost" className="flex-1" onClick={onTitle}>{L.toTitle}</Button>
      </div>
    </section>
  );
}
