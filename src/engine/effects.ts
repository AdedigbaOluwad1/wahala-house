import { pushNews } from "./news";
import { getPolicy } from "./policies";
import type { Effect, GameState, StateData, StateTarget } from "./state";

const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function resolveScope(g: GameState, scope: string): StateData[] {
  if (scope === "all") return g.states;
  if (scope.startsWith("zone:"))
    return g.states.filter((s) => s.zone === scope.slice(5));
  if (scope.startsWith("trait:"))
    return g.states.filter((s) => s.traits.includes(scope.slice(6) as never));
  return g.states.filter((s) => s.id === scope);
}

function applyStateDelta(
  s: StateData,
  target: StateTarget,
  delta: number,
): void {
  if (target === "mood") s.eventMood += delta;
  else s[target] = clamp(s[target] + delta);
}

export function applyEffect(g: GameState, effect: Effect): void {
  if (effect.kind === "national") {
    const n = g.national;
    if (effect.meter === "treasury")
      n.treasury = Math.max(0, n.treasury + effect.delta);
    else if (effect.meter === "inflation")
      n.inflation = Math.max(0, n.inflation + effect.delta);
    else n[effect.meter] = clamp(n[effect.meter] + effect.delta);
    return;
  }
  if (effect.kind === "ongoing") {
    g.ongoing.push({
      target: effect.target,
      scope: effect.scope ?? "all",
      perTick: effect.perTick,
      until: g.tick + effect.ticks,
    });
    return;
  }
  for (const s of resolveScope(g, effect.scope))
    applyStateDelta(s, effect.target, effect.delta);
}

export function applyScheduled(g: GameState): void {
  const due = g.scheduled.filter((e) => e.applyAtTick <= g.tick);
  if (due.length === 0) return;
  g.scheduled = g.scheduled.filter((e) => e.applyAtTick > g.tick);
  const announced = new Set<string>();
  for (const e of due) {
    applyEffect(g, e.effect);
    if (e.policyId && e.phase) {
      g.landed.push({
        tick: g.tick,
        policyId: e.policyId,
        phase: e.phase,
        note: e.note,
      });
      const policyName = getPolicy(e.policyId)?.name ?? e.policyId;
      if (e.phase === "side" && e.note)
        pushNews(g, "policy_side_landed", { policy: policyName, note: e.note });
      else if (e.phase === "main" && !announced.has(e.policyId)) {
        announced.add(e.policyId);
        pushNews(g, "policy_landed", { policy: policyName });
      }
    }
  }
}

export function applyOngoing(g: GameState): void {
  g.ongoing = g.ongoing.filter((o) => o.until > g.tick);
  for (const o of g.ongoing) {
    if (o.target === "revenue") continue;
    if (o.target === "inflation") {
      g.national.inflation = Math.max(0, g.national.inflation + o.perTick);
      continue;
    }
    for (const s of resolveScope(g, o.scope))
      applyStateDelta(s, o.target, o.perTick);
  }
}

export function ongoingRevenue(g: GameState): number {
  let total = 0;
  for (const o of g.ongoing)
    if (o.target === "revenue" && o.until > g.tick) total += o.perTick;
  return total;
}
