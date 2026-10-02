import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MeterCard({ label, value, icon: Icon, tone = 'default', fill }: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'default' | 'good' | 'bad';
  fill?: number;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-white/10 bg-card px-2 py-1.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={cn(
          'grid size-7 shrink-0 place-items-center rounded-lg',
          tone === 'good' && 'bg-success/25 text-success-ink',
          tone === 'bad' && 'bg-destructive/25 text-destructive-ink',
          tone === 'default' && 'bg-primary/20 text-primary',
        )}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="truncate text-sm font-extrabold tabular-nums">{value}</div>
        </div>
      </div>
      {fill !== undefined && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30" aria-hidden="true">
          <div className="h-full bg-primary/80" style={{ width: `${Math.min(100, Math.max(0, fill))}%` }} />
        </div>
      )}
    </div>
  );
}
