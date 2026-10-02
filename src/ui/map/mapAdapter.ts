import nigeria from '@svg-maps/nigeria';

export interface MapRegion {
  id: string;
  path: string;
}

const MAP_TO_ENGINE: Record<string, string> = { nassarawa: 'nasarawa' };

export const MAP_VIEWBOX = nigeria.viewBox;
export const MAP_REGIONS: MapRegion[] = nigeria.locations.map((l) => ({
  id: MAP_TO_ENGINE[l.id] ?? l.id,
  path: l.path,
}));

let cached: Record<string, { x: number; y: number }> | null = null;

export function regionCentres(): Record<string, { x: number; y: number }> {
  if (cached) return cached;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', MAP_VIEWBOX);
  svg.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
  document.body.appendChild(svg);
  const out: Record<string, { x: number; y: number }> = {};
  for (const r of MAP_REGIONS) {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', r.path);
    svg.appendChild(p);
    const b = p.getBBox();
    out[r.id] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  svg.remove();
  cached = out;
  return out;
}
