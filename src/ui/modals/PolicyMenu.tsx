import { useState } from "react";
import {
  ArrowLeft,
  Clock,
  Coins,
  Gavel,
  HeartPulse,
  Landmark,
  Shield,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  ADVISOR_IDS,
  ASSEMBLY,
  assemblyOdds,
  cooldownRemaining,
  isActive,
  pendingEffects,
} from "../../engine";
import type { AdvisorId, GameState, Policy } from "../../engine";
import { POLICIES } from "../../content/policies";
import { strings } from "../../content/strings/en";
import { useGame } from "../../store/gameStore";
import { formatMoney } from "../format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const p = strings.policies;
const ZONES = ["NC", "NE", "NW", "SE", "SS", "SW"] as const;
const ADVISOR_ICONS = {
  finance: Coins,
  security: Shield,
  health: HeartPulse,
  politics: Gavel,
} as const;

function nextLanding(game: GameState, policyId: string): number | null {
  const pending = pendingEffects(game, policyId);
  if (pending.length === 0) return null;
  return Math.max(
    1,
    Math.min(...pending.map((e) => e.applyAtTick)) - game.tick,
  );
}

function statusOf(
  game: GameState,
  policy: Policy,
): { label: string; tone: "ok" | "wait" | "none" } {
  const landing = nextLanding(game, policy.id);
  if (landing !== null) return { label: p.pending(landing), tone: "wait" };
  if (isActive(game, policy.id)) return { label: p.active, tone: "ok" };
  const cd = cooldownRemaining(game, policy.id);
  if (cd > 0) return { label: p.cooldown(cd), tone: "wait" };
  return { label: "", tone: "none" };
}

function PolicyCard({
  game,
  policy,
  onOpen,
}: {
  game: GameState;
  policy: Policy;
  onOpen: () => void;
}) {
  const status = statusOf(game, policy);
  return (
    <button
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-xl border border-white/10 border-b-4 border-b-black/30 bg-card p-3 text-left transition-transform hover:brightness-110 active:translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-extrabold leading-tight">{policy.name}</span>
        <Badge variant="secondary">{p.categories[policy.category]}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Coins className="size-3.5 text-primary" aria-hidden="true" />
          {policy.cost > 0 ? formatMoney(policy.cost) : p.free}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />
          {p.weeks(policy.delayTicks)}
        </span>
        {policy.needsAssembly && (
          <span className="flex items-center gap-1">
            <Gavel className="size-3.5" aria-hidden="true" />
            {p.assembly}
          </span>
        )}
      </div>
      {status.tone !== "none" && (
        <span
          className={cn(
            "w-fit rounded-full px-2 py-0.5 text-xs font-bold",
            status.tone === "ok"
              ? "bg-success/25 text-success-ink"
              : "bg-primary/25 text-primary",
          )}
        >
          {status.label}
        </span>
      )}
    </button>
  );
}

function Detail({
  game,
  policy,
  onBack,
}: {
  game: GameState;
  policy: Policy;
  onBack: () => void;
}) {
  const enact = useGame((s) => s.enact);
  const [sweetener, setSweetener] = useState(0);
  const [zone, setZone] = useState<string | null>(null);
  const treasury = game.national.treasury;
  const maxSweetener = Math.floor(
    Math.min(
      Math.max(0, treasury - policy.cost),
      ASSEMBLY.maxBonus * ASSEMBLY.costPerPoint,
    ),
  );
  const spend = Math.min(sweetener, maxSweetener);
  const odds = policy.needsAssembly ? assemblyOdds(game, policy, spend) : null;
  const status = statusOf(game, policy);
  const blockedReason =
    status.tone !== "none" &&
    (!policy.repeatable || cooldownRemaining(game, policy.id) > 0)
      ? status.label
      : treasury < policy.cost + spend
        ? p.failures.insufficient_funds
        : policy.needsZone && !zone
          ? p.failures.zone_required
          : null;

  const submit = () => {
    const result = enact(policy.id, {
      sweetener: spend,
      zone: zone ?? undefined,
    });
    if (result.ok) {
      toast.success(
        result.delayedBy > 0
          ? p.toastDelayed(policy.name, result.delayedBy)
          : p.toastEnacted(policy.name),
      );
      onBack();
    } else if (result.reason === "vote_failed") {
      toast.error(p.toastVoteFailed);
      onBack();
    } else {
      toast.error(p.failures[result.reason]);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
        <ArrowLeft />
        {p.back}
      </Button>
      <div>
        <h3 className="text-xl font-extrabold">{policy.name}</h3>
        <p className="text-sm text-muted-foreground">{policy.description}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-black/30 p-2">
          <div className="text-muted-foreground">{p.cost}</div>
          <div className="font-extrabold">
            {policy.cost > 0 ? formatMoney(policy.cost) : p.free}
          </div>
        </div>
        <div className="rounded-xl bg-black/30 p-2">
          <div className="text-muted-foreground">{p.running}</div>
          <div className="font-extrabold">
            {policy.runningCost
              ? `${formatMoney(policy.runningCost)}/wk`
              : p.free}
          </div>
        </div>
        <div className="rounded-xl bg-black/30 p-2">
          <div className="text-muted-foreground">{p.delay}</div>
          <div className="font-extrabold">{p.weeks(policy.delayTicks)}</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{p.hiddenSide}</p>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {p.advisors}
        </h4>
        {ADVISOR_IDS.map((id: AdvisorId) => {
          const Icon = ADVISOR_ICONS[id];
          return (
            <div key={id} className="flex gap-2 rounded-xl bg-card p-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="text-sm">
                <span className="font-bold">{strings.advisors[id]}: </span>
                {policy.advisorTake[id]}
              </div>
            </div>
          );
        })}
      </div>

      {policy.needsZone && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {p.pickZone}
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ZONES.map((z) => (
              <Button
                key={z}
                variant="secondary"
                aria-pressed={zone === z}
                onClick={() => setZone(z)}
              >
                {strings.zones[z]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {odds && (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-card p-3">
          <div className="flex items-center gap-2 font-bold">
            <Gavel className="size-4 text-primary" aria-hidden="true" />
            {p.vote}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {p.voteSupport}:{" "}
              <b className="text-foreground">
                {Math.round(odds.support + odds.bonus)}
              </b>
            </span>
            <span>
              {p.voteNeeded}:{" "}
              <b className="text-foreground">{Math.round(odds.needed)}</b>
            </span>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-black/40"
            role="progressbar"
            aria-label={p.voteChance(Math.round(odds.chance * 100))}
            aria-valuenow={Math.round(odds.chance * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-success"
              style={{ width: `${odds.chance * 100}%` }}
            />
          </div>
          <div className="text-sm font-bold">
            {p.voteChance(Math.round(odds.chance * 100))}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-bold">
              <Wallet className="size-3.5" aria-hidden="true" />
              {p.sweetener}
            </span>
            <span className="tabular-nums">{formatMoney(spend)}</span>
          </div>
          <Slider
            aria-label={p.sweetener}
            min={0}
            max={Math.max(ASSEMBLY.costPerPoint, maxSweetener)}
            step={ASSEMBLY.costPerPoint}
            value={[spend]}
            disabled={maxSweetener < ASSEMBLY.costPerPoint}
            onValueChange={(v) => setSweetener(Array.isArray(v) ? v[0] : v)}
          />
          <p className="text-xs text-muted-foreground">{p.sweetenerHelp}</p>
        </div>
      )}

      {blockedReason && (
        <p className="text-sm font-semibold text-primary">{blockedReason}</p>
      )}
      <Button
        size="lg"
        variant="success"
        disabled={blockedReason !== null}
        onClick={submit}
      >
        <Landmark />
        {policy.needsAssembly ? p.holdVote : p.enact}
      </Button>
    </div>
  );
}

export function PolicyMenu({
  game,
  open,
  onOpenChange,
}: {
  game: GameState;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const policy = POLICIES.find((x) => x.id === selected);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setSelected(null);
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {policy ? (
          <Detail
            game={game}
            policy={policy}
            onBack={() => setSelected(null)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{p.title}</DialogTitle>
              <DialogDescription>{p.description}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              {POLICIES.map((x) => (
                <PolicyCard
                  key={x.id}
                  game={game}
                  policy={x}
                  onOpen={() => setSelected(x.id)}
                />
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
