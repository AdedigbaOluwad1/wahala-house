import { MapPin, Users, UserRound, X } from "lucide-react";
import type { GameState } from "../../engine";
import { SECTORS } from "../../engine";
import { strings } from "../../content/strings/en";
import { METRIC_ICONS } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatBar } from "@/components/game/StatBar";

export function StatePanel({
  game,
  stateId,
  onClose,
}: {
  game: GameState;
  stateId: string | null;
  onClose: () => void;
}) {
  const s = game.states.find((x) => x.id === stateId);
  if (!s) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <MapPin className="size-4" aria-hidden="true" />
        {strings.noSelection}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-3 lg:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold leading-tight">{s.name}</h2>
          <p className="text-sm text-muted-foreground">
            {strings.zones[s.zone]}
          </p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="lg:hidden"
          onClick={onClose}
          aria-label={strings.closePanel}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {s.traits.map((t) => (
          <Badge key={t} variant="secondary">
            {strings.traits[t]}
          </Badge>
        ))}
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-3.5" aria-hidden="true" />
          {strings.population}
        </dt>
        <dd className="font-semibold">{(s.population / 1e6).toFixed(1)}m</dd>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <UserRound className="size-3.5" aria-hidden="true" />
          {strings.governor}
        </dt>
        <dd className="font-semibold">{s.governor}</dd>
      </dl>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 lg:grid-cols-1">
        <StatBar
          label={strings.metrics.mood}
          value={s.mood}
          icon={METRIC_ICONS.mood}
        />
        {SECTORS.map((k) => (
          <StatBar
            key={k}
            label={strings.metrics[k]}
            value={s[k]}
            icon={METRIC_ICONS[k]}
          />
        ))}
      </div>
    </div>
  );
}
