import type { GameEvent } from '../../engine/events';
import disaster from './disaster.json';
import economy from './economy.json';
import health from './health.json';
import politics from './politics.json';
import power from './power.json';
import security from './security.json';
import social from './social.json';

export const EVENTS = [security, disaster, health, economy, power, politics, social].flat() as unknown as GameEvent[];
