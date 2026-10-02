import { AlertTriangle, Coins, Gavel, HeartPulse, Shield } from 'lucide-react';
import { eventTokens, fillTokens, getEvent, ADVISOR_IDS } from '../../engine';
import type { ActiveEvent, AdvisorId, GameState } from '../../engine';
import { strings } from '../../content/strings/en';
import { toast } from 'sonner';
import { useGame } from '../../store/gameStore';
import { formatMoney } from '../format';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ADVISOR_ICONS = { finance: Coins, security: Shield, health: HeartPulse, politics: Gavel } as const;
const e = strings.events;

export function EventDialog({ game, active, forced, onDismiss }: {
  game: GameState; active: ActiveEvent; forced: boolean; onDismiss: () => void;
}) {
  const resolve = useGame((s) => s.resolve);
  const ev = getEvent(active.eventId);
  if (!ev) return null;
  const tokens = eventTokens(game, active);
  const weeksLeft = active.expiresTick !== undefined ? Math.max(1, active.expiresTick - game.tick) : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !forced) onDismiss(); }}>
      <DialogContent showCloseButton={!forced} className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ev.severity === 3 ? 'destructive' : 'secondary'}>
              <AlertTriangle aria-hidden="true" />
              {ev.severity === 3 ? e.mustDecide : weeksLeft !== null ? e.expiresIn(weeksLeft) : ''}
            </Badge>
          </div>
          <DialogTitle className="text-lg">{fillTokens(ev.title, tokens)}</DialogTitle>
          <DialogDescription>{fillTokens(ev.body, tokens)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{e.respond}</h4>
          {ev.choices.map((c) => {
            const short = c.cost !== undefined && game.national.treasury < c.cost;
            return (
              <button
                key={c.id}
                disabled={short}
                onClick={() => {
                  const result = resolve(active.uid, c.id);
                  if (!result.ok) toast.error(e.cantAfford);
                }}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border border-white/10 border-b-4 border-b-black/30 bg-card p-3 text-left transition-transform hover:brightness-110 active:translate-y-0.5 disabled:opacity-50',
                  c.ignore && 'bg-muted/60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold leading-tight">{fillTokens(c.label, tokens)}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
                    <Coins className="size-3.5" aria-hidden="true" />
                    {c.cost ? formatMoney(c.cost) : e.free}
                  </span>
                </div>
                {short && <span className="text-xs font-semibold text-destructive-ink">{e.cantAfford}</span>}
                {c.advisorReactions && (
                  <div className="flex flex-col gap-1">
                    {ADVISOR_IDS.filter((id) => c.advisorReactions?.[id]).map((id: AdvisorId) => {
                      const Icon = ADVISOR_ICONS[id];
                      return (
                        <div key={id} className="flex gap-2 text-xs text-muted-foreground">
                          <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          <span><b className="text-foreground">{strings.advisors[id]}:</b> {fillTokens(c.advisorReactions![id]!, tokens)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
