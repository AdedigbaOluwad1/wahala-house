import { useState } from "react";
import { CalendarCheck, Coins, Gavel, HeartPulse, Shield } from "lucide-react";
import {
  SECTORS,
  TICKS_PER_QUARTER,
  debtServicePerTick,
  gameDate,
  projectedFundingRatios,
  quarterBriefing,
} from "../../engine";
import type { Budget, GameState, Sector } from "../../engine";
import { ADVISORS } from "../../content/advisors";
import { strings } from "../../content/strings/en";
import { METRIC_ICONS } from "../icons";
import { formatMoney } from "../format";
import { rebalance } from "../budgetMath";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ADVISOR_ICONS = {
  finance: Coins,
  security: Shield,
  health: HeartPulse,
  politics: Gavel,
} as const;
const ALLOCATION_KEYS = ["need", "population", "loyalty"] as const;
type AllocationKey = (typeof ALLOCATION_KEYS)[number];

function level(ratio: number): { label: string; className: string } {
  const l = strings.budget.levels;
  if (ratio < 0.5)
    return {
      label: l.starved,
      className: "bg-destructive/25 text-destructive-ink",
    };
  if (ratio < 0.8)
    return { label: l.thin, className: "bg-primary/25 text-primary" };
  if (ratio < 1.1)
    return { label: l.ok, className: "bg-success/25 text-success-ink" };
  return { label: l.full, className: "bg-success/25 text-success-ink" };
}

function Row({
  icon: Icon,
  title,
  help,
  value,
  onChange,
  trailing,
}: {
  icon?: (typeof METRIC_ICONS)[keyof typeof METRIC_ICONS];
  title: string;
  help: string;
  value: number;
  onChange: (v: number) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold">
          {Icon && <Icon className="size-4 text-primary" aria-hidden="true" />}
          {title}
        </div>
        <div className="text-lg font-extrabold tabular-nums">
          {Math.round(value * 100)}%
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
      <Slider
        className="mt-3"
        aria-label={title}
        min={0}
        max={100}
        step={1}
        value={[Math.round(value * 100)]}
        onValueChange={(v) => onChange((Array.isArray(v) ? v[0] : v) / 100)}
      />
      {trailing && (
        <div className="mt-2 flex items-center justify-between text-xs">
          {trailing}
        </div>
      )}
    </div>
  );
}

export function BudgetDialog({
  game,
  onConfirm,
}: {
  game: GameState;
  onConfirm: (b: Budget) => void;
}) {
  const [draft, setDraft] = useState<Budget>(() => ({
    shares: { ...game.budget.shares },
    allocation: { ...game.budget.allocation },
  }));
  const d = gameDate(game.tick);
  const ratios = projectedFundingRatios(game, draft);
  const programme = game.programmePerTick * TICKS_PER_QUARTER;
  const debt = debtServicePerTick(game) * TICKS_PER_QUARTER;
  const b = strings.budget;

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck className="size-5 text-primary" aria-hidden="true" />
            {b.title(d.year, d.quarter)}
          </DialogTitle>
          <DialogDescription>{b.description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            [b.envelope, programme + debt],
            [b.debtService, debt],
            [b.programme, programme],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl bg-black/30 p-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="text-sm font-extrabold tabular-nums">
                {formatMoney(value as number)}
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="briefing">
          <TabsList className="w-full">
            <TabsTrigger value="briefing">{strings.briefing.tab}</TabsTrigger>
            <TabsTrigger value="sectors">{b.tabSectors}</TabsTrigger>
            <TabsTrigger value="split">{b.tabSplit}</TabsTrigger>
          </TabsList>
          <TabsContent value="briefing" className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {strings.briefing.intro}
            </p>
            {quarterBriefing(game).map(({ advisor, text }) => {
              const Icon = ADVISOR_ICONS[advisor];
              return (
                <div
                  key={advisor}
                  className="flex gap-3 rounded-xl border border-white/10 bg-card p-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="text-sm">
                    <div className="font-extrabold">
                      {ADVISORS[advisor].name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ADVISORS[advisor].title}
                    </div>
                    <p className="mt-1">{text}</p>
                  </div>
                </div>
              );
            })}
          </TabsContent>
          <TabsContent value="sectors" className="flex flex-col gap-2">
            {SECTORS.map((sector: Sector) => {
              const lv = level(ratios[sector]);
              return (
                <Row
                  key={sector}
                  icon={METRIC_ICONS[sector]}
                  title={strings.metrics[sector]}
                  help={strings.sectorHelp[sector]}
                  value={draft.shares[sector]}
                  onChange={(v) =>
                    setDraft((x) => ({
                      ...x,
                      shares: rebalance(x.shares, sector, v),
                    }))
                  }
                  trailing={
                    <>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMoney(programme * draft.shares[sector])}{" "}
                        {b.perQuarter}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-bold",
                          lv.className,
                        )}
                      >
                        {lv.label} ·{" "}
                        {b.coverageOfNeed(Math.round(ratios[sector] * 100))}
                      </span>
                    </>
                  }
                />
              );
            })}
          </TabsContent>
          <TabsContent value="split" className="flex flex-col gap-2">
            {ALLOCATION_KEYS.map((key: AllocationKey) => (
              <Row
                key={key}
                title={b.allocation[key]}
                help={b.allocationHelp[key]}
                value={draft.allocation[key]}
                onChange={(v) =>
                  setDraft((x) => ({
                    ...x,
                    allocation: rebalance(x.allocation, key, v),
                  }))
                }
              />
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:flex-row">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => onConfirm(game.budget)}
          >
            {b.keep}
          </Button>
          <Button variant="success" size="lg" onClick={() => onConfirm(draft)}>
            {b.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
