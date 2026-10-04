import { describe, expect, it } from "vitest";
import {
  ADVISOR_IDS,
  ALLOWED_TAGS,
  ALLOWED_TOKENS,
  BANNED_ACRONYMS,
  BANNED_WORDS,
  NATIONAL_FIELDS,
  NATIONAL_METERS,
  STAT_FIELDS,
  TRAITS,
  ZONES,
} from "./contentRules";
import { EVENTS } from "../src/content/events";
import { AMBIENT_TEMPLATES, NEWS_TEMPLATES } from "../src/content/news";
import { ADVISORS } from "../src/content/advisors";
import { POLICIES } from "../src/content/policies";
import { STATE_ROWS } from "../src/content/states";
import type { Choice, Condition, GameEvent } from "../src/engine/events";
import type { NewsTemplate } from "../src/engine/news";

const STATE_IDS = STATE_ROWS.map((r) => r[0]);
const POLICY_IDS = POLICIES.map((p) => p.id);
const allTemplates = Object.values(NEWS_TEMPLATES);

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(strings);
  return [];
}

function tokensIn(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

function conditionProblems(
  c: Condition,
  scope: "state" | "national" | "ambient",
): string[] {
  const out: string[] = [];
  const stateOnly =
    c.type === "stat" ||
    c.type === "trait" ||
    c.type === "zone" ||
    c.type === "state";
  if (stateOnly && scope !== "state")
    out.push(`${c.type} condition needs state scope`);
  if (
    scope === "ambient" &&
    c.type !== "avg" &&
    c.type !== "national" &&
    c.type !== "policy" &&
    c.type !== "quarter" &&
    c.type !== "minTick"
  )
    out.push(`bad ambient condition ${c.type}`);
  switch (c.type) {
    case "stat":
    case "avg":
      if (!STAT_FIELDS.includes(c.stat)) out.push(`bad stat ${c.stat}`);
      if (c.op !== "<" && c.op !== ">") out.push("bad op");
      break;
    case "national":
      if (!NATIONAL_FIELDS.includes(c.field)) out.push(`bad field ${c.field}`);
      if (c.op !== "<" && c.op !== ">") out.push("bad op");
      break;
    case "trait":
      if (!TRAITS.includes(c.trait)) out.push(`bad trait ${c.trait}`);
      break;
    case "zone":
      if (!ZONES.includes(c.zone)) out.push(`bad zone ${c.zone}`);
      break;
    case "state":
      if (!STATE_IDS.includes(c.id)) out.push(`bad state ${c.id}`);
      break;
    case "policy":
      if (!POLICY_IDS.includes(c.policyId))
        out.push(`bad policy ${c.policyId}`);
      break;
    case "quarter":
      if (c.quarters.some((q) => q < 1 || q > 4)) out.push("bad quarter");
      break;
    case "minTick":
      break;
    case "mode":
      if (c.mode !== "term" && c.mode !== "survival") out.push("bad mode");
      break;
    default:
      out.push(`unknown condition ${(c as { type: string }).type}`);
  }
  return out;
}

function scopeOk(scope: string, eventScope: "state" | "national"): boolean {
  if (scope === "$state" || scope === "$zone") return eventScope === "state";
  if (scope === "all") return true;
  if (scope.startsWith("zone:")) return ZONES.includes(scope.slice(5));
  if (scope.startsWith("trait:")) return TRAITS.includes(scope.slice(6));
  return STATE_IDS.includes(scope);
}

function effectProblems(choice: Choice, ev: GameEvent): string[] {
  const out: string[] = [];
  for (const e of choice.effects) {
    if (e.after !== undefined && (e.after < 1 || e.after > 52))
      out.push("bad after");
    if (e.kind === "stat") {
      if (!STAT_FIELDS.includes(e.target)) out.push(`bad target ${e.target}`);
      if (!scopeOk(e.scope, ev.scope)) out.push(`bad scope ${e.scope}`);
      if (Math.abs(e.delta) > 15) out.push(`delta too big ${e.delta}`);
    } else if (e.kind === "national") {
      if (!NATIONAL_METERS.includes(e.meter)) out.push(`bad meter ${e.meter}`);
      const limit =
        e.meter === "treasury" ? 500 : e.meter === "inflation" ? 8 : 25;
      if (Math.abs(e.delta) > limit) out.push(`delta too big ${e.delta}`);
    } else if (e.kind === "ongoing") {
      if (!(
        STAT_FIELDS.includes(e.target) ||
        e.target === "revenue" ||
        e.target === "inflation"
      ))
        out.push(`bad ongoing ${e.target}`);
      if (e.scope && !scopeOk(e.scope, ev.scope))
        out.push(`bad scope ${e.scope}`);
      if (
        Math.abs(e.perTick) > (e.target === "revenue" ? 10 : 0.5) ||
        e.ticks < 1 ||
        e.ticks > 104
      )
        out.push("ongoing out of range");
    } else {
      out.push("unknown effect kind");
    }
  }
  return out;
}

describe("event content", () => {
  it("has unique snake_case ids", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it.each(EVENTS.map((e) => [e.id, e] as const))(
    "%s is well formed",
    (_id, ev) => {
      const problems: string[] = [];
      if (!ev.title || ev.title.length > 60) problems.push("title length");
      if (!ev.body || ev.body.length > 400) problems.push("body length");
      if (ev.scope !== "state" && ev.scope !== "national")
        problems.push("scope");
      if (![1, 2, 3].includes(ev.severity)) problems.push("severity");
      if (!(ev.baseProbability > 0 && ev.baseProbability <= 0.05))
        problems.push("baseProbability");
      if (!(ev.cooldownTicks >= 8)) problems.push("cooldownTicks");
      if (ev.advisor && !ADVISOR_IDS.includes(ev.advisor))
        problems.push("advisor");
      if (
        ev.risk &&
        !["insurgencyRisk", "unrest", "corruption"].includes(ev.risk)
      )
        problems.push("risk");
      if (ev.risk && ev.scope !== "state")
        problems.push("risk needs state scope");
      if (ev.tags.length === 0) problems.push("tags empty");
      for (const t of ev.tags)
        if (!ALLOWED_TAGS.includes(t)) problems.push(`tag ${t}`);
      for (const c of ev.conditions)
        problems.push(...conditionProblems(c, ev.scope));

      const ignores = ev.choices.filter((c) => c.ignore);
      if (ev.severity === 1) {
        if (ev.choices.length !== 1 || ignores.length !== 1)
          problems.push("severity 1 needs exactly one ignore choice");
      } else {
        if (ev.choices.length < 2 || ev.choices.length > 3)
          problems.push("2-3 choices needed");
        if (ignores.length !== 1)
          problems.push("exactly one ignore choice needed");
      }
      const choiceIds = ev.choices.map((c) => c.id);
      if (new Set(choiceIds).size !== choiceIds.length)
        problems.push("duplicate choice ids");
      for (const c of ev.choices) {
        if (!c.label || c.label.length > 60) problems.push(`label ${c.id}`);
        if (c.cost !== undefined && (c.cost <= 0 || c.cost > 400))
          problems.push(`cost ${c.id}`);
        if (c.ignore && c.cost) problems.push("ignore choice cannot cost");
        if (c.newsTemplateId && !NEWS_TEMPLATES[c.newsTemplateId])
          problems.push(`missing news ${c.newsTemplateId}`);
        for (const k of Object.keys(c.advisorReactions ?? {}))
          if (!ADVISOR_IDS.includes(k)) problems.push(`reaction ${k}`);
        problems.push(...effectProblems(c, ev));
      }
      if (ev.newsTemplateId && !NEWS_TEMPLATES[ev.newsTemplateId])
        problems.push(`missing news ${ev.newsTemplateId}`);
      for (const ch of ev.chains ?? []) {
        if (ch.eventId === ev.id) problems.push("self chain");
        if (!EVENTS.some((e) => e.id === ch.eventId))
          problems.push(`chain target ${ch.eventId}`);
        if (ch.delayTicks < 1 || ch.delayTicks > 26)
          problems.push("chain delay");
        if (ch.ifChoice && !choiceIds.includes(ch.ifChoice))
          problems.push(`chain ifChoice ${ch.ifChoice}`);
      }
      for (const text of [
        ev.title,
        ev.body,
        ...ev.choices.flatMap((c) => [
          c.label,
          ...Object.values(c.advisorReactions ?? {}),
        ]),
      ]) {
        for (const tok of tokensIn(text)) {
          if (!ALLOWED_TOKENS.includes(tok)) problems.push(`token ${tok}`);
          if (
            ev.scope === "national" &&
            (tok === "state" || tok === "governor")
          )
            problems.push(`token ${tok} in national event`);
        }
      }
      expect(problems).toEqual([]);
    },
  );

  it("serious events keep a restrained tone", () => {
    for (const ev of EVENTS.filter((e) => e.tags.includes("serious"))) {
      const ids = [
        ev.newsTemplateId,
        ...ev.choices.map((c) => c.newsTemplateId),
      ].filter(Boolean) as string[];
      for (const text of [
        ev.body,
        ...ids.flatMap((id) => strings(NEWS_TEMPLATES[id])),
      ]) {
        expect(text, `${ev.id}`).not.toMatch(/[!]|\p{Extended_Pictographic}/u);
      }
    }
  });

  it("news templates match the scope of the events that use them", () => {
    for (const ev of EVENTS.filter((e) => e.scope === "national")) {
      const ids = [
        ev.newsTemplateId,
        ...ev.choices.map((c) => c.newsTemplateId),
      ].filter(Boolean) as string[];
      for (const id of ids) {
        for (const text of strings(NEWS_TEMPLATES[id])) {
          for (const tok of tokensIn(text))
            expect(["state", "governor"], `${id}`).not.toContain(tok);
        }
      }
    }
  });
});

describe("news content", () => {
  it("has unique ids and enough variants in both tones", () => {
    const ids = allTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of allTemplates) {
      expect(t.dry.length, `${t.id} dry`).toBeGreaterThanOrEqual(2);
      expect(t.wahala.length, `${t.id} wahala`).toBeGreaterThanOrEqual(2);
      for (const text of [...t.dry, ...t.wahala]) {
        expect(text.length, t.id).toBeLessThanOrEqual(160);
        for (const tok of tokensIn(text))
          expect(ALLOWED_TOKENS, `${t.id} ${tok}`).toContain(tok);
      }
    }
  });

  it("ambient templates only use valid conditions", () => {
    for (const t of AMBIENT_TEMPLATES as NewsTemplate[]) {
      for (const c of t.conditions ?? [])
        expect(conditionProblems(c, "ambient"), t.id).toEqual([]);
      for (const text of [...t.dry, ...t.wahala])
        expect(tokensIn(text), t.id).toEqual([]);
    }
  });

  it("every event news template is used by an event", () => {
    const used = new Set(
      EVENTS.flatMap((e) => [
        e.newsTemplateId,
        ...e.choices.map((c) => c.newsTemplateId),
      ]).filter(Boolean),
    );
    for (const t of allTemplates) {
      if (t.id.startsWith("ev."))
        expect(used.has(t.id), `${t.id} unused`).toBe(true);
    }
  });
});

describe("banned terms", () => {
  const corpus = [
    ...strings(EVENTS),
    ...strings(allTemplates),
    ...strings(ADVISORS),
    ...strings(
      POLICIES.map((p) => ({
        n: p.name,
        d: p.description,
        a: p.advisorTake,
        e: [...p.effects, ...p.sideEffects].map(
          (e) => (e as { note?: string }).note,
        ),
      })),
    ),
  ];
  it("contains no real people, parties, agencies, groups or religions", () => {
    for (const text of corpus) {
      for (const w of BANNED_WORDS) {
        const re = new RegExp(
          `(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`,
          "i",
        );
        expect(re.test(text), `"${w}" in: ${text}`).toBe(false);
      }
      for (const a of BANNED_ACRONYMS) {
        expect(new RegExp(`\\b${a}\\b`).test(text), `${a} in: ${text}`).toBe(
          false,
        );
      }
    }
  });
});

describe("v1 content targets", () => {
  it("has at least 25 events across the main categories", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(25);
    const has = (tag: string) => EVENTS.some((e) => e.tags.includes(tag));
    for (const tag of [
      "security",
      "economy",
      "health",
      "disaster",
      "power",
      "politics",
      "social",
    ])
      expect(has(tag), tag).toBe(true);
    expect(EVENTS.some((e) => e.severity === 3)).toBe(true);
    expect(EVENTS.some((e) => (e.chains ?? []).length > 0)).toBe(true);
  });
  it("has at least 12 ambient headlines", () => {
    expect(AMBIENT_TEMPLATES.length).toBeGreaterThanOrEqual(12);
  });
});
