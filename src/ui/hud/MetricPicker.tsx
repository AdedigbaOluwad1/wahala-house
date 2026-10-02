import { strings } from '../../content/strings/en';
import { LEGEND_GRADIENT } from '../map/colors';
import { METRICS, useGame } from '../../store/gameStore';

export function MetricPicker() {
  const metric = useGame((s) => s.metric);
  const setMetric = useGame((s) => s.setMetric);
  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <div className="flex items-center gap-2">
        <label htmlFor="metric" className="sr-only text-sm text-emerald-100 sm:not-sr-only">{strings.metricLabel}</label>
        <select
          id="metric"
          className="h-10 rounded bg-black/40 px-2 text-sm"
          value={metric}
          onChange={(e) => setMetric(e.target.value as typeof metric)}
        >
          {METRICS.map((m) => <option key={m} value={m}>{strings.metrics[m]}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 text-xs text-emerald-100">
        <span>{strings.legendLow}</span>
        <div className="h-2 flex-1 rounded" style={{ background: LEGEND_GRADIENT }} aria-hidden="true" />
        <span>{strings.legendHigh}</span>
      </div>
    </div>
  );
}
