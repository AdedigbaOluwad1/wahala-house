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

## Phase 3 decisions
- **shadcn/ui** (base-nova style, Base UI primitives) with a dark green and gold game theme. The CLI generated a utils file importing an unrelated `cn` npm package; replaced with the standard `clsx` + `tailwind-merge` helper.
- **Effect timing:** every policy effect lands at enactment tick + `after` (default: the policy's `delayTicks`, plus a delay-risk extension for main effects). Side effects may set an earlier `after`, for example inflation spikes landing before a slow payoff. This refines the spec line that all effects land after the delay.
- **Ongoing effects** (`kind: "ongoing"`) apply a per-tick change for N ticks once they land. Revenue and inflation effects hit national meters; the rest apply to states by scope (`all`, `zone:NE`, `trait:oil`, a state id, or `$zone` for the zone the player picks).
- **Assembly votes are probabilistic:** pass if support + sweetener bonus + noise (sd 6) >= threshold. The UI shows the exact chance. Sweeteners cost 8 per point, capped at 30 points. A failed vote costs the sweetener, 6 support, and blocks a retry for 4 weeks. Brutal difficulty raises thresholds by 6 points.
- **Policy numbers are first-pass** and need tuning with the Phase 7 bots. Policy text lives in JSON, not the strings files, so it is not translated yet.
- **Budget** is chosen at quarter start in a dialog; "Keep last budget" is always available. Sector funding previews show the national coverage of need.
- **Action log** (`actions` in the store) records budget and policy actions with their tick, ready for saving in Phase 6.

## Phase 4 decisions
- **Events:** tick order is now clock, scheduled effects, ongoing, funding, stats, hidden, mood, national, event roll, news thresholds, ambient news, end checks. Up to 2 events fire per tick and 4 can be active. Only one severity 3 event can be pending, and it pauses the game. Severity 2 events auto-ignore after 8 weeks. Severity 1 events resolve immediately with the effects of their single ignore choice.
- **Cooldowns** apply per event, and per event and state for state-scope events. Chained follow-ups respect their cooldown too, and are dropped if still cooling down.
- **Chain-only events** use a `minTick` condition of 1,000,000 so they never fire on their own. A national event cannot chain to a state event (no state to target).
- **Condition streaks:** `forTicks` is tracked per condition in `events.streaks`, updated every tick for every event.
- **News:** items store the template id, tokens and a variant number, and are rendered at display time, so toggling tone changes the whole log instantly. Threshold headlines fire once per crossing. Ambient headlines have a 7% chance per tick and per-template cooldowns.
- **Advisers** are fictional names with conditional briefing lines in `src/content/advisors.ts`, shown on the first tab of the budget dialog. The quarterly briefing screen from the spec is folded into that dialog.
- **Content:** 28 events and about 120 news templates were written for this phase, with lint rules in `tests/content.test.ts` (schema, references, tone for serious events, banned real names, parties, agencies, groups and religions). The unique Lagos, Kano, Rivers, Borno and FCT events and the Pidgin pass are still Phase 7. The Pidgin and humour in this batch need review by native speakers.
- **National stress events** (price shock, strike notice, FX crunch, grid collapse, Assembly standoff) only fire when the country is under strain, so a healthy default game rarely sees them. A test confirms they fire under stress. Revisit frequency in Phase 7.
- **Map markers** appear on states with a pending severity 2 or 3 event and flash briefly after any state event resolves; the per-choice `mapEffect` field is stored but not yet used by the UI.
- **E2E hook:** builds made with `VITE_E2E=1` expose `window.__wahala` (engine and store) so Playwright can trigger events deterministically. It is absent from normal builds.

## Phase 5 decisions
- **Election rule as implemented:** a candidate wins the first round outright only with the most votes AND at least 25% in 24 of the 36 states (two-thirds, rounded up) AND at least 25% in the FCT, counted separately. Otherwise the top two go to a runoff decided by plurality, with a share of eliminated voters moving mostly to the non-incumbent finalist. This follows a strict reading of the spec; the constitutional wording and court interpretation still need checking (toggle `ELECTION.fctSeparate` in `balance.ts`).
- **Vote model:** per-state strengths from mood, national approval, governor loyalty, stability and opposition strength, raised to a power and normalised, with a national swing of about 4 points and small per-state noise. Turnout is population times a mood-based factor. A do-nothing game loses, a balanced game with mood above about 50 wins, and the margin in between is noisy by design.
- **Terms:** with terms allowed set to N, the election at the end of term N is skipped and the game ends as "term limit". With one allowed term there is no election. Winning an election starts a new term with a small honeymoon (stability, approval, Assembly support up, opposition down).
- **Survival mode** has no scheduled election and uses a survival-only opposition surge event instead.
- **Score:** weeks survived x (0.4 + 0.3 x average approval + 0.3 x average stability, each as a fraction), plus 500 per election won and 300 for completing the allowed terms.
- **Biggest trade-off:** the enacted policy with the most landed side effects and cost, using a one-line `tradeoff` string per policy; with no policies, the biggest gap between budget shares and the defaults.
- **Share image** is drawn on a canvas in the browser and shared with the Web Share API when it supports files, otherwise downloaded as a PNG.
- **Language flavour** (English or English plus Pidgin) is not in the setup screen yet: the Pidgin string file arrives in Phase 7, so the control would do nothing. The news tone toggle covers the Pidgin headlines for now.
- **UI flow:** title, setup, game, legacy. An election dialog takes priority over any event or budget dialog opened on the same tick.

## Phase 6 decisions
- **Save format:** `{ format, version, savedAt, config, seed, state, actions, ui }` as JSON. `state` is the full engine state (it is plain JSON), so a restored game continues byte-for-byte like the original; tests assert this. The action log is stored too, so a save can be replayed. `SAVE_VERSION` is 1 and `migrate` has no steps yet; a future change must add one.
- **Storage:** IndexedDB database `wahala-house` with `saves` (slots `auto`, `slot-1` to `slot-3`) and `settings`. No localStorage.
- **Autosave** happens when a quarter's budget window opens and when the tab is hidden or the page is left. It is deleted when the game ends. The autosave slot cannot be deleted by hand.
- **Settings:** autosave on or off, animation preference (follow device, reduce, allow), default news tone and default speed. "Delete all saved data" needs a second tap.
- **Accessibility:** axe scans (WCAG 2 A and AA) run in Playwright over the title, setup, budget, map, state panel, policies, news log, menu, settings, event and legacy screens. Fixes: lighter text tokens (`success-ink`, `destructive-ink`) on tinted pills, labelled slider thumbs, keyboard-focusable scrollable regions. The map regions are focusable buttons and the state list is the non-map route.
- **Performance:** the app shell (title and setup) loads without the engine, content or map; the game, legacy report and store load as a separate chunk on Start. Lighthouse mobile on the title screen: performance 97, accessibility 100, best practices 100. At 4x CPU throttle the game holds 60 fps with no long tasks while playing at Fast speed. The in-game screens were measured by hand, not by Lighthouse.
- **Offline:** the service worker precaches all assets including fonts and the lazy chunks; a Playwright test goes offline after first load and starts a game. App icons are PNG (192, 512, maskable 512, Apple touch) generated by `scripts/make-icons.mjs`.
- **Known gaps:** no screen-reader walkthrough on real devices (VoiceOver or TalkBack) was done; only automated checks and keyboard tests. The ticker announces each new headline politely, which may be chatty.

## Phase 7 balance decisions
- **Method:** `npm run sim -- <seeds> [difficulty]` plays five bots (idle, balanced, militarist, austerity, populist) on the headless engine. `sim/trace.ts <bot> <difficulty> <seed>` prints a yearly trace of one run. The `balanced` bot is a mediocre player on purpose, so a human should beat its numbers.
- **Why stats barely responded to budgets:** the default budget funded sectors at about 75% of need, and decay roughly cancelled gain, so every budget ended near stat 49. Gain is now 0.4 and decay 0.365 per tick, and `REFERENCE_PROGRAMME_PER_TICK` is 32. A sector holds its value at a funding ratio of about 0.91; the default budget gives about 0.84, so doing nothing drifts down slowly, while weighting the budget towards the sectors that carry the most mood (economy, security, health) lifts them quickly and starves the rest. Neglected sectors can reach 0.
- **Unrest** used to ratchet: it only fell once a state's mood passed 60. It now relaxes towards a floor of 10 whenever mood is at least 40, which lets a competent game recover.
- **Crisis load** rose far too fast because every event added 1, 4 or 10. It is now 0.5, 2 and 7 per severity and decays 4% a tick.
- **Coup threshold** base is 38 (was 25). With the lower crisis load, do-nothing play no longer produced any coups; it was 42 until the Phase 7 events were added, and the extra event pressure made it ease back.
- **Difficulty:** decay multipliers are 0.93 (easy), 1 and 1.04 (brutal); approval sensitivity is 0.85, 1 and 1.1. The first values (0.8 and 1.25) made easy unloseable and brutal a coup within two years for everyone.
- **Events:** probabilities of the state-scope events that fired 5 to 12 times a game were cut, and the national stress events (price shock, strike notice, FX crunch, medicine shortage, Assembly standoff, pipeline sabotage) now trigger at milder thresholds so they appear in ordinary play.
- **Result, realistic, 100 seeds:** idle is removed 79% of the time (78% coup, about 2.8 years in) and voted out otherwise; balanced is removed 16%, wins a first election 35% of the time and finishes two terms 29%; militarist, austerity and populist never finish two terms (voted out or coup, populist 100% coup after 1.5 years because it starves the security forces). Easy is forgiving (idle usually survives a term) and brutal is very hard (balanced is removed 82% of the time). No event breaks its cooldown in 500 games and only `opposition_surge` (survival mode) never fires.
- **Phase 7 content:** 45 new events (74 in all): 34 general ones across every category, a city or state pair each for Lagos, Kano, Rivers, Borno and the FCT (plus a Rivers follow-up chain), and chain-only follow-ups for communal clashes, the lecturers' strike and the oil spill. The new events were tuned from bot fire rates to about 0.6 firings a game each at most, 25 extra firings a game in total; the first pass doubled the event load and made realistic play far harsher. City events use a `state` condition and carry both the city tag and the zone tag. Choice-level news exists only for the severity 3 events and the main city responses; the rest use the firing headline.
- **Still open:** populist and austerity bots fail faster than a human likely would; the election midpoint was left alone; policy numbers in `policies.json` are still first-pass.

## Open (from spec section 16 and review)
- Election rule: is the 25% threshold required in 24 of 36 states plus a separate FCT check, or 24 of 37 units? Verify against the constitution before shipping.
- Define `needBaseline[state, sector]` (spec 6.3 uses it but never defines it).
- Survival-mode score formula.
- Add a list view of states as an alternative to the map (small-state tap targets, screen readers).
- Verify licences for `@svg-maps/nigeria` (CC BY 4.0 claimed) and `nigerian-geopolitical-zones` before bundling.
- Pidgin and sensitivity review of content by native-speaking reviewers.
- Tutorial/onboarding for the first minutes is not in the spec.
- v2 candidates: accounts and leaderboards, LGA-level detail, more policies, more languages.
