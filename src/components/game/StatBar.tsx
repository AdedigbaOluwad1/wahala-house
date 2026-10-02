import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaleColor } from '@/ui/map/colors';

export function StatBar({ label, value, icon: Icon, className }: {
  label: string; value: number; icon?: LucideIcon; className?: string;
}) {
  const v = Math.round(value);
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          {label}
        </span>
        <span className="tabular-nums">{v}</span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10"
        role="progressbar"
        aria-label={label}
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full border-b-2 border-black/20 motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${Math.max(2, value)}%`, background: scaleColor(value) }}
        />
      </div>
    </div>
  );
}
