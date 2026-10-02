import { CRISIS_PER_SEVERITY, DIFFICULTY, EVENTS as EVENT_LIMITS } from './balance';
import { conditionHolds, updateStreaks } from './conditions';
import type { Condition } from './conditions';
import { applyEffect } from './effects';
import { pushNews } from './news';
import type { Rng } from './rng';
import type { ActiveEvent } from './eventsState';
import type { Effect, GameState, StateData } from './state';
import { ADVISORS } from '../content/advisors';
import { EVENTS } from '../content/events';
import type { AdvisorId } from './policies';

export type { Condition } from './conditions';

export type EventEffect = Effect & { after?: number };

export interface Choice {
  id: string;
  label: string;
  cost?: number;
  ignore?: boolean;
  effects: EventEffect[];
  mapEffect?: 'flash' | 'tint' | 'icon';
  newsTemplateId?: string;
  advisorReactions?: Partial<Record<AdvisorId, string>>;
}

export interface GameEvent {
  id: string;
  title: string;
  body: string;
  tags: string[];
  scope: 'state' | 'national';
  advisor?: AdvisorId;
  conditions: Condition[];
  baseProbability: number;
  risk?: 'insurgencyRisk' | 'unrest' | 'corruption';
  cooldownTicks: number;
  severity: 1 | 2 | 3;
  newsTemplateId?: string;
  choices: Choice[];
  chains?: { eventId: string; delayTicks: number; ifChoice?: string }[];
}

export type { ActiveEvent, EventsState, PendingChain, ResolvedEvent } from './eventsState';
export { emptyEventsState } from './eventsState';

export function getEvent(id: string, events: GameEvent[] = EVENTS): GameEvent | undefined {
  return events.find((e) => e.id === id);
}

function cooldownKey(ev: GameEvent, stateId?: string): string {
  return stateId ? `${ev.id}:${stateId}` : ev.id;
}

function onCooldown(g: GameState, ev: GameEvent, stateId?: string): boolean {
  return (g.events.cooldowns[cooldownKey(ev, stateId)] ?? 0) > g.tick;
}

export function eventTokens(g: GameState, a: Pick<ActiveEvent, 'eventId' | 'stateId'>, events: GameEvent[] = EVENTS): Record<string, string> {
  const ev = getEvent(a.eventId, events);
  const s = a.stateId ? g.states.find((x) => x.id === a.stateId) : undefined;
  return {
    state: s?.name ?? '',
    governor: s?.governor ?? '',
    advisor: ADVISORS[ev?.advisor ?? 'politics'].name,
  };
}

export function fillTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => tokens[k] ?? m);
}

function resolveEventScope(s: StateData | undefined, scope: string): string {
  if (!s) return scope;
  if (scope === '$state') return s.id;
  if (scope === '$zone') return `zone:${s.zone}`;
  return scope;
}

function applyChoiceEffects(g: GameState, choice: Choice, s: StateData | undefined, eventId: string): void {
  for (const e of choice.effects) {
    const resolved: Effect =
      e.kind === 'stat' || e.kind === 'ongoing'
        ? ({ ...e, scope: resolveEventScope(s, e.scope ?? 'all') } as Effect)
        : e;
    const clean = { ...resolved } as Effect & { after?: number };
    delete clean.after;
    if (e.after && e.after > 0) g.scheduled.push({ applyAtTick: g.tick + e.after, effect: clean, eventId });
    else applyEffect(g, clean);
  }
}

function recordResolution(g: GameState, a: ActiveEvent, choice: Choice, auto: boolean): void {
  g.events.history.push({
    uid: a.uid, eventId: a.eventId, stateId: a.stateId, firedTick: a.tick, resolvedTick: g.tick,
    choiceId: choice.id, auto, mapEffect: choice.mapEffect,
  });
  if (g.events.history.length > EVENT_LIMITS.historyCap) g.events.history.shift();
}

export type ResolveResult = { ok: true } | { ok: false; reason: 'unknown_event' | 'unknown_choice' | 'insufficient_funds' };

export function resolveEvent(g: GameState, uid: number, choiceId: string, auto = false, events: GameEvent[] = EVENTS): ResolveResult {
  const a = g.events.active.find((x) => x.uid === uid);
  if (!a) return { ok: false, reason: 'unknown_event' };
  const ev = getEvent(a.eventId, events);
  const choice = ev?.choices.find((c) => c.id === choiceId);
  if (!ev || !choice) return { ok: false, reason: 'unknown_choice' };
  if (choice.cost && g.national.treasury < choice.cost) return { ok: false, reason: 'insufficient_funds' };

  const s = a.stateId ? g.states.find((x) => x.id === a.stateId) : undefined;
  if (choice.cost) g.national.treasury -= choice.cost;
  applyChoiceEffects(g, choice, s, ev.id);
  g.events.active = g.events.active.filter((x) => x.uid !== uid);
  recordResolution(g, a, choice, auto);
  if (ev.severity >= 2) g.timeline.push({ tick: g.tick, type: 'event', refId: ev.id, choiceId: choice.id, stateId: a.stateId, ignored: !!choice.ignore });
  if (choice.newsTemplateId) pushNews(g, choice.newsTemplateId, eventTokens(g, a, events), { severity: ev.severity });

  for (const chain of ev.chains ?? []) {
    if (chain.ifChoice && chain.ifChoice !== choice.id) continue;
    g.events.pendingChains.push({ eventId: chain.eventId, fireTick: g.tick + chain.delayTicks, stateId: a.stateId });
  }
  return { ok: true };
}

export function fireEvent(g: GameState, ev: GameEvent, stateId?: string, events: GameEvent[] = EVENTS): ActiveEvent {
  const active: ActiveEvent = {
    uid: g.events.nextUid++,
    eventId: ev.id,
    stateId,
    tick: g.tick,
    severity: ev.severity,
    expiresTick: ev.severity === 2 ? g.tick + EVENT_LIMITS.optionalWindow : undefined,
  };
  g.events.cooldowns[cooldownKey(ev, stateId)] = g.tick + ev.cooldownTicks;
  g.national.crisisLoad = Math.min(100, g.national.crisisLoad + CRISIS_PER_SEVERITY[ev.severity]);
  if (ev.newsTemplateId) pushNews(g, ev.newsTemplateId, eventTokens(g, active, events), { severity: ev.severity });

  if (ev.severity === 1) {
    g.events.active.push(active);
    const ignore = ev.choices.find((c) => c.ignore) ?? ev.choices[0];
    resolveEvent(g, active.uid, ignore.id, true, events);
  } else {
    g.events.active.push(active);
  }
  return active;
}

function expireOptional(g: GameState, events: GameEvent[]): void {
  for (const a of [...g.events.active]) {
    if (a.expiresTick === undefined || a.expiresTick > g.tick) continue;
    const ev = getEvent(a.eventId, events);
    const ignore = ev?.choices.find((c) => c.ignore) ?? ev?.choices[0];
    if (ev && ignore) resolveEvent(g, a.uid, ignore.id, true, events);
  }
}

function fireDueChains(g: GameState, events: GameEvent[]): void {
  const due = g.events.pendingChains.filter((c) => c.fireTick <= g.tick);
  if (due.length === 0) return;
  g.events.pendingChains = g.events.pendingChains.filter((c) => c.fireTick > g.tick);
  for (const c of due) {
    const ev = getEvent(c.eventId, events);
    if (!ev) continue;
    const stateId = ev.scope === 'state' ? c.stateId : undefined;
    if (onCooldown(g, ev, stateId)) continue;
    fireEvent(g, ev, stateId, events);
  }
}

function eligible(g: GameState, ev: GameEvent, s?: StateData): boolean {
  if (onCooldown(g, ev, s?.id)) return false;
  if (ev.severity === 3 && g.events.active.some((a) => a.severity === 3)) return false;
  return ev.conditions.every((c) => conditionHolds(g, c, s));
}

function probability(g: GameState, ev: GameEvent, s?: StateData): number {
  const freq = DIFFICULTY[g.config.difficulty].eventFrequency;
  const risk = ev.risk && s ? Math.min(3, Math.max(0.2, s[ev.risk] / 50)) : 1;
  return ev.baseProbability * freq * risk;
}

export function rollEvents(g: GameState, rng: Rng, events: GameEvent[] = EVENTS): void {
  updateStreaks(g, events);
  expireOptional(g, events);
  fireDueChains(g, events);
  if (g.tick < EVENT_LIMITS.graceTicks) return;

  let fired = 0;
  const order = [...events];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const ev of order) {
    if (fired >= EVENT_LIMITS.maxFiresPerTick || g.events.active.length >= EVENT_LIMITS.maxActive) break;
    if (ev.scope === 'national') {
      if (eligible(g, ev) && rng.chance(probability(g, ev))) {
        fireEvent(g, ev, undefined, events);
        fired++;
      }
      continue;
    }
    for (const s of g.states) {
      if (!eligible(g, ev, s) || !rng.chance(probability(g, ev, s))) continue;
      fireEvent(g, ev, s.id, events);
      fired++;
      break;
    }
  }
}

export function pendingDecision(g: GameState): ActiveEvent | undefined {
  return g.events.active.find((a) => a.severity === 3);
}

export function activeStateEvents(g: GameState): ActiveEvent[] {
  return g.events.active.filter((a) => a.stateId && a.severity >= 2);
}

