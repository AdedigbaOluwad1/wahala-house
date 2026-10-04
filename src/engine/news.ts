import { NEWS } from "./balance";
import { conditionHolds } from "./conditions";
import type { Condition } from "./conditions";
import type { NewsItem } from "./newsState";
import type { Rng } from "./rng";
import type { GameState } from "./state";
import { AMBIENT_TEMPLATES, NEWS_TEMPLATES } from "../content/news";

export interface NewsTemplate {
  id: string;
  dry: string[];
  wahala: string[];
  conditions?: Condition[];
}

export type { NewsItem, NewsState } from "./newsState";
export { emptyNewsState } from "./newsState";

export function pushNews(
  g: GameState,
  templateId: string,
  tokens: Record<string, string> = {},
  opts: { severity?: 1 | 2 | 3 } = {},
): void {
  if (!NEWS_TEMPLATES[templateId]) return;
  const uid = g.news.seq++;
  g.news.items.push({
    uid,
    tick: g.tick,
    templateId,
    tokens,
    variant: uid,
    severity: opts.severity,
  });
  if (g.news.items.length > NEWS.cap) g.news.items.shift();
}

export function renderNews(item: NewsItem, tone: "dry" | "wahala"): string {
  const t = NEWS_TEMPLATES[item.templateId];
  if (!t) return "";
  const list = tone === "wahala" && t.wahala.length > 0 ? t.wahala : t.dry;
  const text = list[item.variant % list.length] ?? "";
  return text.replace(/\{(\w+)\}/g, (m, k: string) => item.tokens[k] ?? m);
}

interface Threshold {
  id: string;
  templateId: string;
  test: (g: GameState) => boolean;
}

const THRESHOLDS: Threshold[] = [
  {
    id: "approval_low",
    templateId: "threshold.approval_low",
    test: (g) => g.national.approval < 40,
  },
  {
    id: "approval_critical",
    templateId: "threshold.approval_critical",
    test: (g) => g.national.approval < 25,
  },
  {
    id: "treasury_low",
    templateId: "threshold.treasury_low",
    test: (g) => g.national.treasury < 150,
  },
  {
    id: "inflation_high",
    templateId: "threshold.inflation_high",
    test: (g) => g.national.inflation > 25,
  },
  {
    id: "stability_low",
    templateId: "threshold.stability_low",
    test: (g) => g.national.stability < 35,
  },
  {
    id: "naira_weak",
    templateId: "threshold.naira_weak",
    test: (g) => g.national.nairaStrength < 30,
  },
  {
    id: "debt_high",
    templateId: "threshold.debt_high",
    test: (g) => g.national.debt > 5400,
  },
];

export function checkThresholds(g: GameState): void {
  for (const t of THRESHOLDS) {
    const holds = t.test(g);
    if (holds && !g.news.flags[t.id]) {
      g.news.flags[t.id] = true;
      pushNews(g, t.templateId);
    } else if (!holds && g.news.flags[t.id]) {
      g.news.flags[t.id] = false;
    }
  }
}

export function rollAmbient(
  g: GameState,
  rng: Rng,
  pool: NewsTemplate[] = AMBIENT_TEMPLATES,
): void {
  if (!rng.chance(NEWS.ambientChance)) return;
  const options = pool.filter(
    (t) =>
      (g.news.cooldowns[t.id] ?? 0) <= g.tick &&
      (t.conditions ?? []).every((c) => conditionHolds(g, c)),
  );
  if (options.length === 0) return;
  const pick = rng.pick(options);
  g.news.cooldowns[pick.id] = g.tick + NEWS.ambientCooldown;
  pushNews(g, pick.id);
}
