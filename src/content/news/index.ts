import type { NewsTemplate } from '../../engine/news';
import ambient from './ambient.json';
import eventsA from './events-a.json';
import eventsB from './events-b.json';
import system from './system.json';

const all = [eventsA, eventsB, ambient, system].flat() as unknown as NewsTemplate[];

export const NEWS_TEMPLATES: Record<string, NewsTemplate> = Object.fromEntries(all.map((t) => [t.id, t]));
export const AMBIENT_TEMPLATES: NewsTemplate[] = (ambient as unknown as NewsTemplate[]);
