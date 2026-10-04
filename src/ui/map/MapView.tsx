import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { GameState } from "../../engine";
import { strings } from "../../content/strings/en";
import { MAP_REGIONS, MAP_VIEWBOX, regionCentres } from "./mapAdapter";
import { scaleColor } from "./colors";
import type { Metric } from "../../store/gameStore";

interface RegionProps {
  id: string;
  name: string;
  path: string;
  fill: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

const Region = memo(function Region({
  id,
  name,
  path,
  fill,
  selected,
  onSelect,
}: RegionProps) {
  return (
    <path
      d={path}
      fill={fill}
      stroke={selected ? "#ffd23f" : "#0b1f17"}
      strokeWidth={selected ? 2.5 : 0.8}
      vectorEffect="non-scaling-stroke"
      className="cursor-pointer outline-none motion-safe:transition-[fill] motion-safe:duration-300 focus-visible:stroke-white"
      role="button"
      tabIndex={0}
      aria-label={name}
      aria-pressed={selected}
      data-region={id}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
    />
  );
});

const [, , VB_W, VB_H] = MAP_VIEWBOX.split(" ").map(Number);
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

interface View {
  x: number;
  y: number;
  zoom: number;
}

function clampView(v: View): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom));
  const w = VB_W / zoom,
    h = VB_H / zoom;
  return {
    zoom,
    x: Math.min(VB_W - w, Math.max(0, v.x)),
    y: Math.min(VB_H - h, Math.max(0, v.y)),
  };
}

export interface MapMarker {
  uid: number;
  stateId: string;
  severity: 1 | 2 | 3;
  label: string;
}

export function MapView({
  game,
  metric,
  selected,
  onSelect,
  markers = [],
  flashes = [],
  onMarker,
}: {
  game: GameState;
  metric: Metric;
  selected: string | null;
  onSelect: (id: string) => void;
  markers?: MapMarker[];
  flashes?: string[];
  onMarker?: (uid: number) => void;
}) {
  const [centres] = useState(regionCentres);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinchDist: 0 });

  const byId = useMemo(
    () => new Map(game.states.map((s) => [s.id, s])),
    [game.states],
  );

  const handleSelect = useCallback(
    (id: string) => {
      if (gesture.current.moved > 6) return;
      onSelect(id);
    },
    [onSelect],
  );

  const zoomAt = (factor: number, cx = 0.5, cy = 0.5) =>
    setView((v) => {
      const w = VB_W / v.zoom,
        h = VB_H / v.zoom;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const nw = VB_W / zoom,
        nh = VB_H / zoom;
      return clampView({
        zoom,
        x: v.x + (w - nw) * cx,
        y: v.y + (h - nh) * cy,
      });
    });

  const rel = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      cx: (e.clientX - r.left) / r.width,
      cy: (e.clientY - r.top) / r.height,
      r,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = 0;
    gesture.current.pinchDist = 0;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (gesture.current.pinchDist > 0) {
        const mid = rel({
          clientX: (pts[0].x + pts[1].x) / 2,
          clientY: (pts[0].y + pts[1].y) / 2,
        });
        zoomAt(dist / gesture.current.pinchDist, mid.cx, mid.cy);
      }
      gesture.current.pinchDist = dist;
      gesture.current.moved = 99;
      return;
    }
    const dx = next.x - prev.x,
      dy = next.y - prev.y;
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved <= 6) return;
    const { r } = rel({ clientX: next.x, clientY: next.y });
    setView((v) =>
      clampView({
        ...v,
        x: v.x - (dx / r.width) * (VB_W / v.zoom),
        y: v.y - (dy / r.height) * (VB_H / v.zoom),
      }),
    );
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current.pinchDist = 0;
  };
  const onWheel = (e: React.WheelEvent) => {
    const { cx, cy } = rel(e);
    zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, cx, cy);
  };

  const vb = `${view.x} ${view.y} ${VB_W / view.zoom} ${VB_H / view.zoom}`;

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={vb}
        className="h-full w-full touch-none select-none"
        role="group"
        aria-label={strings.mapLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {MAP_REGIONS.map((r) => {
          const s = byId.get(r.id);
          if (!s) return null;
          const value = metric === "mood" ? s.mood : s[metric];
          return (
            <Region
              key={r.id}
              id={r.id}
              name={s.name}
              path={r.path}
              fill={scaleColor(value)}
              selected={selected === r.id}
              onSelect={handleSelect}
            />
          );
        })}
        {flashes.map(
          (id) =>
            centres[id] && (
              <circle
                key={`f-${id}`}
                cx={centres[id].x}
                cy={centres[id].y}
                r={14 / view.zoom}
                fill="none"
                stroke="#ffd23f"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                className="pointer-events-none motion-safe:animate-ping"
              />
            ),
        )}
        {markers.map(
          (m) =>
            centres[m.stateId] && (
              <g
                key={m.uid}
                transform={`translate(${centres[m.stateId].x} ${centres[m.stateId].y}) scale(${1 / view.zoom})`}
                role="button"
                tabIndex={0}
                aria-label={m.label}
                className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-white"
                onClick={() => onMarker?.(m.uid)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onMarker?.(m.uid);
                  }
                }}
              >
                <circle
                  r={11}
                  fill={m.severity === 3 ? "#ef4444" : "#ffd23f"}
                  stroke="#0b1f17"
                  strokeWidth={2}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={14}
                  fontWeight={800}
                  fill="#0b1f17"
                  className="pointer-events-none select-none"
                >
                  !
                </text>
              </g>
            ),
        )}
      </svg>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button
          className="grid h-10 w-10 place-items-center rounded-xl border-b-4 border-black/30 bg-secondary text-xl font-bold"
          aria-label={strings.zoomIn}
          onClick={() => zoomAt(1.5)}
        >
          +
        </button>
        <button
          className="grid h-10 w-10 place-items-center rounded-xl border-b-4 border-black/30 bg-secondary text-xl font-bold"
          aria-label={strings.zoomOut}
          onClick={() => zoomAt(1 / 1.5)}
        >
          −
        </button>
      </div>
    </div>
  );
}
