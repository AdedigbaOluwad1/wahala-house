# Content guide

How to write events and news for Wahala House. Content is data only: adding it never requires engine changes. Run `npx vitest run tests/content.test.ts` to lint everything you write.

## Tone rules (enforced in review)

- Honest mechanics, funny presentation. The humour is in the text, never in the numbers.
- Satirise institutions, bureaucracy and officialdom. Never an ethnic group, a religion, a region's people, or victims of violence.
- Do not name ethnic groups, religions, real people, real parties or real agencies. Use the fictional equivalents: Workers' Congress of Nigeria (WCN), National Oil Corporation (NOC), Federal Revenue Committee, the National Assembly, the Reserve Bank, the National Grid Company, the Federal Roads Agency, the Progressive Peoples Front (PPF) and United Democratic Alliance (UDA).
- Serious events (attacks, deaths, outbreaks, disasters with casualties) carry the tag `serious`. Their text is restrained in both tones: no jokes, no exclamation marks, no emoji. Any humour in their news comes only from the official response ("a committee has been set up to set up a committee"), never from suffering.
- Pidgin (the `wahala` tone) should read naturally and affectionately, like Nigerian radio and Twitter, not a caricature. Keep it light; do not overdo spelling tricks.
- Hazards such as insurgency, banditry and floods are regional risks, not something any people are blamed for.

## Event schema (`src/content/events/<category>.json`, an array)

```json
{
  "id": "grid_collapse",
  "title": "Grid collapse",
  "body": "The national grid has tripped again. {advisor} says it is the third time this month.",
  "tags": ["power", "grid_collapse"],
  "scope": "national",
  "advisor": "finance",
  "conditions": [
    { "type": "avg", "stat": "power", "op": "<", "value": 35, "forTicks": 6 }
  ],
  "baseProbability": 0.01,
  "risk": "unrest",
  "cooldownTicks": 52,
  "severity": 3,
  "newsTemplateId": "ev.grid_collapse",
  "choices": [
    {
      "id": "repair",
      "label": "Fund emergency repairs",
      "cost": 80,
      "effects": [
        { "kind": "stat", "target": "power", "scope": "all", "delta": 6 }
      ],
      "newsTemplateId": "ev.grid_collapse.repair",
      "advisorReactions": {
        "finance": "Expensive, but cheaper than a week of darkness."
      }
    },
    {
      "id": "ignore",
      "label": "Do nothing",
      "ignore": true,
      "effects": [
        { "kind": "stat", "target": "mood", "scope": "all", "delta": -4 }
      ],
      "newsTemplateId": "ev.grid_collapse.ignore"
    }
  ],
  "chains": [
    { "eventId": "market_fire", "delayTicks": 4, "ifChoice": "ignore" }
  ]
}
```

Fields:

- `id`: unique snake_case. `title` max 60 characters. `body` max 400.
- `scope`: `state` fires in one qualifying state per tick; `national` fires once. Body tokens: `{state}`, `{governor}` (state scope only) and `{advisor}` (anyone). `advisor` is one of `finance`, `security`, `health`, `politics` and picks who `{advisor}` refers to.
- `tags`: from the allowed list in `tests/contentRules.ts`. Include the zone tag (for example `north_east`) when the event is tied to a zone through conditions.
- `baseProbability`: chance per eligible state (or per tick for national) per tick, typically 0.0005 to 0.01. There are 52 ticks a year, and a game is 4 to 8 years, so most events should happen a few times per game at most.
- `risk` (optional, state scope): scales probability by that hidden value over 50: `insurgencyRisk`, `unrest` or `corruption`.
- `cooldownTicks`: at least 8. State-scope cooldowns are tracked per state.
- `severity`: 1 is news only (exactly one choice, which has `ignore: true` and holds the automatic effects); 2 is news plus an optional response (2 or 3 choices, auto-ignored after 8 ticks); 3 pauses the game and needs a decision (2 or 3 choices).
- Exactly one choice in a severity 2 or 3 event has `"ignore": true`.
- `chains`: ignoring or responding can spawn a follow-up event after `delayTicks` (1 to 26). `ifChoice` limits it to one choice. The follow-up fires regardless of its own conditions, in the same state if it is state-scope. Do not chain an event to itself.

### Conditions

- `{"type":"stat","stat":S,"op":"<"|">","value":N}`: the event's state (state scope only).
- `{"type":"avg","stat":S,"op":...,"value":N,"forTicks":N?}`: population-weighted national average of a state stat.
- `{"type":"national","field":F,"op":...,"value":N,"forTicks":N?}`: a national meter. Fields: treasury, debt, inflation, nairaStrength, oilPriceIndex, approval, stability, assemblySupport, opposition, crisisLoad.
- `{"type":"trait","trait":T}`, `{"type":"zone","zone":"NC|NE|NW|SE|SS|SW"}`, `{"type":"state","id":"lagos"}`: state scope only.
- `{"type":"policy","policyId":P,"active":true|false}`.
- `{"type":"quarter","quarters":[1..4]}`: seasonal events. `{"type":"minTick","tick":N}`. `{"type":"mode","mode":"term"|"survival"}`: limit an event to one game mode.
- State stats S: economy, security, health, education, infrastructure, power, welfare, mood, unrest, corruption, insurgencyRisk, governorLoyalty. All 0 to 100. Starting averages sit around 40 to 55 for the visible stats, inflation starts at 15, approval near 40 to 50.
- Traits: oil, agriculture, commercial_hub, urban_dense, border, conflict_zone, riverine, flood_prone, mining, port.

### Effects

- `{"kind":"stat","target":T,"scope":SC,"delta":N,"after":N?}`: T is any state stat field above. Keep deltas within about +/-12.
- `{"kind":"national","meter":M,"delta":N}`: M is inflation, nairaStrength, approval, stability, assemblySupport, opposition, crisisLoad or treasury.
- `{"kind":"ongoing","target":T|"revenue"|"inflation","scope":SC,"perTick":N,"ticks":N}`: a change applied every tick; keep perTick under 0.3 for stats.
- Scope: `all`, `zone:NE`, `trait:oil`, `$state` (the event's state) or `$zone` (that state's zone). `$state` and `$zone` only in state-scope events. Use `$state` for local effects and `all` or `zone:` for national effects.
- `after` (ticks) delays an effect.
- `mood` changes are one-off shocks that fade over about 10 ticks. Use around -3 to -10 for bad news.
- Choice `cost` is taken from the treasury (typical treasury is 100 to 1000; costs of 20 to 150).

Make the trade-offs real: the costly response should help more than doing nothing, ignoring should hurt or chain into something worse, and a "clever" cheap option should have a hidden downside.

## News templates (`src/content/news/*.json`, arrays)

```json
{
  "id": "ev.grid_collapse",
  "dry": ["The national grid has collapsed.", "..."],
  "wahala": ["Light don go again...", "..."]
}
```

- At least 2 variants for each tone. Tokens: `{state}`, `{governor}`, `{advisor}` (event templates), `{policy}`, `{note}` (system templates).
- Event news ids follow `ev.<eventId>` for the event firing and `ev.<eventId>.<choiceId>` for a resolution. Reference them from `newsTemplateId`.
- Templates used by a national event must not use `{state}` or `{governor}`.
- Headlines are one sentence, about 15 words or fewer.
- `ambient.json` templates are generic satire shown now and then. They may have `conditions` (only `avg`, `national`, `policy`, `quarter`, `minTick`). Examples of the target voice: "Senate approves budget after 11 hours of debate, 9 of them about lunch." "Fuel queues in the North now have their own postcode." Keep ambient jokes about officialdom, not people.
