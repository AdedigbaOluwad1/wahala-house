import { ADVISORS } from '../content/advisors';
import { conditionHolds } from './conditions';
import { ADVISOR_IDS } from './policies';
import type { AdvisorId } from './policies';
import type { GameState } from './state';

export function briefingFor(g: GameState, id: AdvisorId): string {
  const lines = ADVISORS[id].briefing;
  const match = lines.find((l) => (l.when ?? []).every((c) => conditionHolds(g, c)));
  return (match ?? lines[lines.length - 1]).text;
}

export function quarterBriefing(g: GameState): { advisor: AdvisorId; text: string }[] {
  return ADVISOR_IDS.map((advisor) => ({ advisor, text: briefingFor(g, advisor) }));
}
