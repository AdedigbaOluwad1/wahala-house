# Decisions and open items

## Decided
- **Title:** Wahala House (chosen 2026-10-02). Domain/trademark availability not yet checked.
- **Scaffold:** hand-written Vite + React + TS (strict) + Tailwind v4 + Vitest + vite-plugin-pwa. ESLint forbids React/DOM imports under `src/engine`.

## Phase 1 decisions
- **State data is hand-entered** in `src/content/states.ts` (rough populations/areas), not read from `nigerian-geopolitical-zones`, so there is no runtime dependency or licence question yet. Replace or cross-check when licences are verified.
- **Extra `welfare` stat** on every state (spec had 6 stats). It is the Social Welfare sector's target, so all 7 budget sectors map 1:1 to a stat. Mood weights: economy .25, security .25, health .15, power .10, infrastructure .10, education .05, welfare .10 (sum 1.0).
- **`needBaseline`**: reference programme (36/tick) x default sector share x population share x trait multiplier (e.g. conflict zones need more security).
- **Quarterly envelope**: expected revenue x 1.08 (deliberate small deficit), minus debt service. Debt service therefore squeezes programme spending as debt grows.
- **Money** is in abstract units per tick; revenue starts near 38-44 per tick.
- **Borrowing** is automatic: treasury is topped up to a reserve of 100 until a debt ceiling of 6000. Past the ceiling, programme funding is scaled down by what the treasury can pay.
- **Budget window** does not block `stepTick`; `shouldAutoPause` in `clock.ts` tells the UI loop when to stop. Bots must call `setBudget` or clear the flag.
- **Pipeline** implements steps 1-7 and 10. Event roll (8) and news (9) arrive in Phase 4; policy effects reach the engine through `scheduled` effects.
- **Seed**: an empty seed falls back to `Date.now()` once at game creation, then the resolved seed is stored.

## Balance observations (seed "test", Realistic, survival)
- Zero funding: an average state's mood falls to roughly 39 at 2 years and 32 at 3 years. The spec target was 25-35 over 1-2 years, so the decay is still a bit gentle. Recheck in Phase 7.
- Default budget left untouched: no removal in 10 years, approval settles near 34, opposition near 80. Spending everything on welfare ends in a coup at about 5.7 years. Do-nothing removal timing is a Phase 7 tuning item.
- Borno starts with mood around 15 and stays low; that matches the spec's intent but may be too punishing early.

## Phase 2 decisions
- **Map package** `@svg-maps/nigeria` 2.0.0 is confirmed CC-BY-4.0 (LICENSE.md ships in the package). Ids match engine ids except `nassarawa`, remapped in `src/ui/map/mapAdapter.ts`. Local type shim in `src/svg-maps.d.ts`.
- **Choropleth palette** is viridis-style (colour-blind safe), with a legend.
- **State list select** next to the map is the keyboard and small-state alternative to tapping tiny regions; map regions are also focusable buttons.
- **Quarter prompt** is a placeholder that keeps the current budget; the real budget modal is Phase 3.
- **Mood at start** is computed when a game is created so the map is not uniform.
- **Project rules:** no inline code comments (user preference); rationale goes in this file. A README is kept current from day zero.
- **Project licence** not chosen yet.

## Open (from spec section 16 and review)
- Election rule: is the 25% threshold required in 24 of 36 states plus a separate FCT check, or 24 of 37 units? Verify against the constitution before shipping.
- Define `needBaseline[state, sector]` (spec 6.3 uses it but never defines it).
- Survival-mode score formula.
- No-input bot removal timing per difficulty (Phase 7 acceptance).
- Add a list view of states as an alternative to the map (small-state tap targets, screen readers).
- Verify licences for `@svg-maps/nigeria` (CC BY 4.0 claimed) and `nigerian-geopolitical-zones` before bundling.
- Pidgin and sensitivity review of content by native-speaking reviewers.
- Balance constants: tune after bot runs (Phase 7).
- Tutorial/onboarding for the first minutes is not in the spec.
- v2 candidates: accounts and leaderboards, LGA-level detail, more policies, more languages.
