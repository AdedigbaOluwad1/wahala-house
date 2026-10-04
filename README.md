# Wahala House

A browser-based governance sandbox set in a Nigeria-scale country. You are the president: set budgets, pass policies, handle crises and manage politics, then watch the 36 states and the FCT react on an interactive map and in a satirical news feed.

The point is to make the complexity of governing felt. Every decision costs something somewhere else.

> Status: early development. Phases 0-6 are done (scaffold, headless engine, map and HUD, budget and policies, events and news, game modes and endings, saving and offline play). Content and balance tuning are next. See [Roadmap](#roadmap).

## Principles

- **Honest mechanics, funny presentation.** Cause and effect follow real-world logic; the satire lives in text, never in the logic.
- **Satire targets institutions and bureaucracy, never people or groups.** No jokes about any ethnic group, religion, region's people or victims of violence.
- **Fictional names on real structures.** Invented parties, politicians and agencies; no real people or parties.
- **Data-driven content.** Events, policies, advisors and news are data files, so adding content needs no engine changes.
- **Engine is separate from UI.** The simulation is pure TypeScript, deterministic for a given seed, and testable headless.
- **Light and offline-friendly.** Aimed at mid-range Android phones, installable as a PWA.

## Quick start

Requires Node 22 or newer.

```
npm install
npm run dev
```

Then open the URL Vite prints. Press Start, confirm the first quarter's budget, and press Play. Use the Policies button to enact policies.

## Scripts

| Command                                | What it does                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                          | Dev server with hot reload                                                                                                          |
| `npm run build`                        | Typecheck and production build (with PWA service worker)                                                                            |
| `npm run preview`                      | Serve the production build locally                                                                                                  |
| `npm run lint`                         | ESLint, including the rule that keeps the engine free of UI imports                                                                 |
| `npm test`                             | Vitest engine tests                                                                                                                 |
| `npx vitest run tests/content.test.ts` | Content lint for events, news and banned terms                                                                                      |
| `npm run e2e`                          | Playwright tests (desktop and 360 px phone) including offline, saving and axe accessibility scans; builds and serves the app itself |
| `node scripts/make-icons.mjs`          | Regenerates the PNG app icons from `public/icon.svg`                                                                                |

First-time e2e setup: `npx playwright install chromium`.

## Project layout

```
src/
  engine/     pure TypeScript simulation: clock, rng, balance, state, budget, tick, end conditions
  content/    data only: states, strings (more arrive with policies, events, news)
  components/ shadcn/ui primitives and small game widgets
  ui/         React: map, hud, panels, modals, screens
  store/      Zustand bindings to the engine
  persistence/ reserved for IndexedDB saves
tests/        Vitest unit and scenario tests
e2e/          Playwright smoke tests
DECISIONS.md  design decisions, balance notes and open questions
CONTENT_GUIDE.md  how to write events and news (schema, tone rules)
```

## How the simulation works

- One tick is one in-game week; 13 ticks make a quarter and 52 make a year.
- Each tick runs a fixed pipeline: clock, scheduled effects, funding, stat update, hidden values, mood, national meters, end checks.
- The player sets a quarterly budget: shares across seven sectors, and how each sector's money is split across states by need, population and political loyalty. Corruption leaks part of the money before it arrives.
- Randomness only comes from a seeded RNG, so the same seed and the same actions give the same game.
- Policies are data in `src/content/policies.json`. Each has a cost, a delay, and main and side effects that land on a schedule; some need an Assembly vote that you can sweeten with treasury money.
- Events are data in `src/content/events/*.json`: tag- and condition-driven, with cooldowns, chains and 2-3 choices. Severity 3 events pause the game until you decide. News headlines come from templates in two tones (Dry and Full Naija Wahala), and the tone toggle applies instantly, including to the log.
- Advisers brief you each quarter and weigh in on events and policies. They often disagree.
- All tunable constants live in `src/engine/balance.ts`.

Removal can come by coup, impeachment or fiscal collapse. Term mode adds an election at the end of each term; survival mode runs until you are removed. To win an election a candidate needs the most votes and at least 25% of the vote in two-thirds of the states and in the FCT; miss that and the country goes to a runoff. When the game ends you get a legacy report (score, what changed, what you traded away, key moments) and a shareable image.

## Roadmap

| Phase | Scope                                               | Status |
| ----- | --------------------------------------------------- | ------ |
| 0     | Scaffold, CI, PWA plugin                            | Done   |
| 1     | Headless engine core                                | Done   |
| 2     | Map and HUD                                         | Done   |
| 3     | Budget dialog, 12 policies, Assembly votes          | Done   |
| 4     | Events, news in two tones, advisors                 | Done   |
| 5     | Setup screen, modes, election, legacy report        | Done   |
| 6     | Saving, offline, accessibility and performance pass | Done   |
| 7     | Content fill, Pidgin pass, balance tuning with bots | Next   |

## Saving and offline

- The game autosaves at the start of every quarter and whenever you leave the tab, and resumes from the title screen with Continue.
- Three manual save slots, plus export and import of save files as JSON, are in the in-game menu. Everything is stored in your browser's IndexedDB; nothing leaves your device.
- Saves are versioned. A save from a newer version is refused with a clear message; older versions go through migrations.
- After the first load the game works offline and can be installed as an app.

## UI

The interface uses [shadcn/ui](https://ui.shadcn.com) components on Tailwind v4 with a custom game theme: chunky buttons, icon meters, progress-style stat bars and toasts for policy outcomes.

## Credits and licences

- Map: [`@svg-maps/nigeria`](https://www.npmjs.com/package/@svg-maps/nigeria), based on MapSVG's map of Nigeria, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). A credit will also appear in the in-app About screen.
- State populations and areas are rough public estimates entered by hand.
- Project licence: not yet chosen (see `DECISIONS.md`).
