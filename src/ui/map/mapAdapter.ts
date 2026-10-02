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
