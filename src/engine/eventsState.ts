export type MapEffect = 'flash' | 'tint' | 'icon';

export interface ActiveEvent {
  uid: number;
  eventId: string;
  stateId?: string;
  tick: number;
  severity: 1 | 2 | 3;
  expiresTick?: number;
}

export interface ResolvedEvent {
  uid: number;
  eventId: string;
  stateId?: string;
  firedTick: number;
  resolvedTick: number;
  choiceId: string;
  auto: boolean;
  mapEffect?: MapEffect;
}

export interface PendingChain {
  eventId: string;
  fireTick: number;
  stateId?: string;
}

export interface EventsState {
  active: ActiveEvent[];
  cooldowns: Record<string, number>;
  pendingChains: PendingChain[];
  history: ResolvedEvent[];
  streaks: Record<string, number>;
  nextUid: number;
}

export function emptyEventsState(): EventsState {
  return { active: [], cooldowns: {}, pendingChains: [], history: [], streaks: {}, nextUid: 1 };
}

