import { CheckCircle2, Vote, XCircle } from 'lucide-react';
import type { Candidate, ElectionResult, ElectionRound } from '../../engine';
import { strings } from '../../content/strings/en';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const t = strings.election;
const COLOURS: Record<Candidate, string> = { player: 'bg-primary', uda: 'bg-sky-400', third: 'bg-fuchsia-400' };

function Round({ title, round, candidates }: { title: string; round: ElectionRound; candidates: Candidate[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-3">
      <div className="font-extrabold">{title}</div>
      <div className="flex flex-col gap-1.5" aria-label={t.nationalVote}>
        {candidates.map((c) => {
          const pct = Math.round(round.nationalShares[c] * 100);
          return (
            <div key={c} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>{t.candidates[c]}</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-black/40" role="progressbar" aria-label={t.candidates[c]} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn('h-full', COLOURS[c])} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
        <div>{t.statesMeeting(t.candidates[round.leader], round.statesMeeting[round.leader], round.statesRequired)}</div>
        <div className="flex items-center gap-1">
          {round.fctMet[round.leader] ? <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" /> : <XCircle className="size-3.5 text-destructive" aria-hidden="true" />}
          {t.fct}: {round.fctMet[round.leader] ? t.yes : t.no}
        </div>
      </div>
    </div>
  );
}

export function ElectionDialog({ result, nextTerm, onContinue }: { result: ElectionResult; nextTerm: number; onContinue: () => void }) {
  const verdict = result.playerWon
    ? result.runoffHeld ? t.verdict.wonRunoff : t.verdict.won
    : result.runoffHeld ? t.verdict.lostRunoff : t.verdict.lost;
  const finalists = result.runoff ? (['player', 'uda', 'third'] as Candidate[]).filter((c) => result.runoff!.totals[c] > 0) : [];

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg"><Vote className="size-5 text-primary" aria-hidden="true" />{t.title}</DialogTitle>
          <DialogDescription>{t.description(result.term)} {t.spread}</DialogDescription>
        </DialogHeader>
        <Round title={t.firstRound} round={result.first} candidates={['player', 'uda', 'third']} />
        {result.runoff && <Round title={t.runoff} round={result.runoff} candidates={finalists} />}
        <div className={cn('rounded-xl p-3 text-center font-extrabold', result.playerWon ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive')}>
          {verdict}
          <div className="text-xs font-semibold text-foreground">{t.winnerLine(t.candidates[result.winner])}</div>
        </div>
        {result.playerWon && <p className="text-center text-xs text-muted-foreground">{t.wonHint}</p>}
        <Button size="lg" variant="success" onClick={onContinue}>{result.playerWon ? t.continueTerm(nextTerm) : t.seeLegacy}</Button>
      </DialogContent>
    </Dialog>
  );
}
