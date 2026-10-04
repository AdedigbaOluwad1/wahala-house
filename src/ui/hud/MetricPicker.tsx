import { strings } from "../../content/strings/en";
import { METRICS, useGame } from "../../store/gameStore";
import { LEGEND_GRADIENT } from "../map/colors";
import { METRIC_ICONS } from "../icons";
import { Button } from "@/components/ui/button";

export function MetricPicker() {
  const metric = useGame((s) => s.metric);
  const setMetric = useGame((s) => s.setMetric);
  return (
    <div className="min-w-0 flex-1 px-2 py-1.5">
      <div
        role="group"
        aria-label={strings.metricLabel}
        className="flex gap-1 overflow-x-auto pb-1"
      >
        {METRICS.map((m) => {
          const Icon = METRIC_ICONS[m];
          return (
            <Button
              key={m}
              variant="secondary"
              size="sm"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className="shrink-0"
            >
              <Icon aria-hidden="true" />
              {strings.metrics[m]}
            </Button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{strings.legendLow}</span>
        <div
          className="h-2 w-40 rounded-full"
          style={{ background: LEGEND_GRADIENT }}
          aria-hidden="true"
        />
        <span>{strings.legendHigh}</span>
      </div>
    </div>
  );
}
