import type { Trait, Zone } from '../engine/state';

type Row = [id: string, name: string, zone: Zone, popM: number, areaKm2: number, revenueBase: number, traits: Trait[]];

export const STATE_ROWS: Row[] = [
  ['abia', 'Abia', 'SE', 3.7, 4900, 30, ['commercial_hub']],
  ['adamawa', 'Adamawa', 'NE', 4.5, 36917, 22, ['agriculture', 'border', 'conflict_zone']],
  ['akwa-ibom', 'Akwa Ibom', 'SS', 6.0, 7081, 55, ['oil', 'riverine']],
  ['anambra', 'Anambra', 'SE', 5.6, 4844, 38, ['commercial_hub', 'urban_dense', 'flood_prone']],
  ['bauchi', 'Bauchi', 'NE', 7.5, 45837, 20, ['agriculture']],
  ['bayelsa', 'Bayelsa', 'SS', 2.4, 10773, 45, ['oil', 'riverine', 'flood_prone']],
  ['benue', 'Benue', 'NC', 6.1, 34059, 25, ['agriculture', 'flood_prone', 'conflict_zone']],
  ['borno', 'Borno', 'NE', 6.2, 70898, 18, ['border', 'conflict_zone']],
  ['cross-river', 'Cross River', 'SS', 4.2, 20156, 30, ['border', 'agriculture']],
  ['delta', 'Delta', 'SS', 6.0, 17698, 60, ['oil', 'riverine', 'flood_prone']],
  ['ebonyi', 'Ebonyi', 'SE', 3.2, 5670, 18, ['agriculture', 'mining']],
  ['edo', 'Edo', 'SS', 4.7, 17802, 35, ['agriculture']],
  ['ekiti', 'Ekiti', 'SW', 3.6, 6353, 20, ['agriculture']],
  ['enugu', 'Enugu', 'SE', 4.6, 7161, 32, ['mining', 'urban_dense']],
  ['gombe', 'Gombe', 'NE', 3.9, 18768, 18, ['agriculture']],
  ['imo', 'Imo', 'SE', 5.4, 5530, 33, ['oil', 'urban_dense']],
  ['jigawa', 'Jigawa', 'NW', 6.9, 23154, 22, ['agriculture', 'border', 'flood_prone']],
  ['kaduna', 'Kaduna', 'NW', 9.2, 46053, 40, ['commercial_hub', 'conflict_zone']],
  ['kano', 'Kano', 'NW', 15.0, 20131, 65, ['commercial_hub', 'urban_dense', 'agriculture']],
  ['katsina', 'Katsina', 'NW', 9.3, 24192, 25, ['agriculture', 'border', 'conflict_zone']],
  ['kebbi', 'Kebbi', 'NW', 4.8, 36800, 20, ['agriculture', 'border', 'flood_prone']],
  ['kogi', 'Kogi', 'NC', 4.5, 29833, 25, ['mining', 'riverine', 'flood_prone']],
  ['kwara', 'Kwara', 'NC', 3.6, 36825, 25, ['agriculture']],
  ['lagos', 'Lagos', 'SW', 15.5, 3345, 100, ['commercial_hub', 'urban_dense', 'port', 'flood_prone']],
  ['nasarawa', 'Nasarawa', 'NC', 2.9, 27117, 20, ['mining', 'conflict_zone']],
  ['niger', 'Niger', 'NC', 6.2, 76363, 28, ['agriculture', 'flood_prone', 'conflict_zone']],
  ['ogun', 'Ogun', 'SW', 6.1, 16762, 55, ['commercial_hub', 'border']],
  ['ondo', 'Ondo', 'SW', 4.7, 15500, 35, ['oil', 'riverine']],
  ['osun', 'Osun', 'SW', 4.7, 9251, 25, ['agriculture', 'mining']],
  ['oyo', 'Oyo', 'SW', 8.1, 28454, 40, ['urban_dense', 'agriculture']],
  ['plateau', 'Plateau', 'NC', 4.7, 30913, 25, ['mining', 'conflict_zone']],
  ['rivers', 'Rivers', 'SS', 7.7, 11077, 85, ['oil', 'port', 'riverine', 'urban_dense']],
  ['sokoto', 'Sokoto', 'NW', 5.7, 25973, 22, ['agriculture', 'border', 'conflict_zone']],
  ['taraba', 'Taraba', 'NE', 3.1, 54473, 18, ['agriculture', 'border', 'conflict_zone']],
  ['yobe', 'Yobe', 'NE', 3.7, 45502, 15, ['border', 'conflict_zone']],
  ['zamfara', 'Zamfara', 'NW', 5.1, 39762, 20, ['mining', 'conflict_zone']],
  ['fct', 'Federal Capital Territory', 'NC', 3.6, 7315, 70, ['urban_dense']],
];

type Stats = [economy: number, security: number, health: number, education: number, infrastructure: number, power: number, welfare: number];

export const ZONE_BASE_STATS: Record<Zone, Stats> = {
  NC: [48, 48, 48, 50, 45, 42, 40],
  NE: [32, 30, 36, 34, 34, 30, 32],
  NW: [36, 40, 38, 32, 38, 34, 32],
  SE: [52, 58, 52, 62, 50, 45, 40],
  SS: [55, 50, 50, 56, 48, 42, 38],
  SW: [62, 62, 58, 64, 56, 52, 42],
};

export const STATE_OVERRIDES: Record<string, Partial<Stats>> = {
  lagos: [85, 58, 62, 70, 65, 60],
  kano: [62, 45, 42, 38, 50, 42],
  rivers: [70, 40, 50, 55, 55, 45],
  borno: [22, 15, 25, 22, 25, 22],
  fct: [70, 62, 65, 66, 72, 65],
};

export const ZONE_HAZARD: Record<Zone, number> = { NC: 30, NE: 55, NW: 50, SE: 20, SS: 28, SW: 12 };
export const STATE_HAZARD_OVERRIDES: Record<string, number> = { borno: 75, lagos: 10, fct: 20 };

export function hazardBase(id: string, zone: Zone, traits: readonly Trait[]): number {
  if (id in STATE_HAZARD_OVERRIDES) return STATE_HAZARD_OVERRIDES[id];
  return ZONE_HAZARD[zone] + (traits.includes('conflict_zone') ? 8 : 0) + (traits.includes('oil') ? 4 : 0);
}

export const GOVERNOR_FIRST_NAMES = [
  'Chinedu', 'Aminu', 'Tunde', 'Ngozi', 'Ibrahim', 'Efe', 'Bukola', 'Musa', 'Emeka', 'Hauwa',
  'Femi', 'Ogechi', 'Danjuma', 'Titilayo', 'Ekong', 'Binta', 'Obinna', 'Yetunde', 'Garba', 'Ifeoma',
];
export const GOVERNOR_LAST_NAMES = [
  'Okonkwo', 'Bello', 'Adeyemi', 'Ibekwe', 'Yusuf', 'Udoh', 'Balogun', 'Danladi', 'Nwosu', 'Abubakar',
  'Ojo', 'Etim', 'Lawal', 'Eze', 'Garuba', 'Akpan', 'Salihu', 'Onyema', 'Ajayi', 'Tanko',
];
export const GOVERNOR_TITLES = ['His Excellency', 'Distinguished', 'Chief', 'Alhaji', 'Dr.'];
