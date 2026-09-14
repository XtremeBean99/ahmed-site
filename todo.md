# todo.md

Working backlog for approved designs and implementation plans (owner convention: designs and plans
live here, not in `docs/`). Task IDs are prefixed per feature to avoid collisions.

---

## APPROVED DESIGN — Pixel Catan (offline singleplayer)

Approved 13 September 2026. Developed on branch `feat/catan` in an isolated worktree because other
site work is landing on `master` concurrently.

### Goal
A fully playable, offline, singleplayer game of Catan (base-game rules) in the site's pixel-art
style: one human against 2 or 3 heuristic bots. No server, no network after page load.

### Decisions
- **Ruleset:** full official base game. Roads, settlements, cities with piece limits (15/5/4),
  distance rule, 19-per-resource bank with the shortage rule, robber and the 7 (discard half above
  7 cards, move, steal), all five development card types (25-card deck), Largest Army (3+ knights),
  Longest Road (5+, breakable by settlements), 3:1 and 2:1 harbours, domestic trade, win at 10 VP on
  your own turn. Board uses the variable setup with red numbers (6/8) never adjacent.
- **Opponents:** heuristic bots. They take full turns (setup, building, robber, discards, dev
  cards, harbour trades) and accept or reject the human's trade offers. Bots never initiate trades.
- **Placement:** standalone full-viewport route `/catan` (not `/games/*`, which 301s to `/`). The
  shelf Catan box in the room (`ROOM_OBJECTS` id `catan`, previously decorative) opens it.
- **Style:** the room's warm palette and pixel font. The board is rasterised per pixel into a
  low-resolution canvas (no anti-aliasing) and scaled up at integer factors with
  `image-rendering: pixelated`; interaction is a layer of real buttons over it.
- **Persistence:** `localStorage` only (`catan-save-v1`), matching Critical Constraint 3. A reload
  resumes the game.

### Architecture
Pure, dependency-free engine in `src/lib/games/catan/`, same philosophy as `breakout-engine.ts`:
plain JSON-serialisable `GameState`, seeded RNG stored in state (reproducible games, safe resume),
no `Math.random`, no React.

| File | Owns |
|---|---|
| `types.ts` | `GameState`, `Player`, `Phase`, `Action`, `GameEvent` unions |
| `constants.ts` | costs, deck, tile and token sets, piece limits |
| `geometry.ts` | static 19-hex topology: 54 vertices, 72 edges, adjacency, harbour edges |
| `rng.ts` | mulberry32 over `state.rng` |
| `helpers.ts` | resource arithmetic, placement legality queries, VP |
| `board.ts` | board generation and `createGame` |
| `setup.ts` | snake-order initial placement |
| `turn.ts` | roll, production, building, buying, maritime/domestic trade, end turn |
| `robber.ts` | discards, robber move, steal |
| `devcards.ts` | playing knight, road building, year of plenty, monopoly; Largest Army |
| `longest-road.ts` | per-player longest road and award rules |
| `engine.ts` | `validateAction` / `applyAction` dispatcher, post-action awards and victory |
| `ai.ts` | `chooseBotAction`, `botAcceptsTrade` |

UI: `src/app/catan/page.tsx` (server shell, metadata) and `src/components/catan/*` (client).
Tests: `node:test` files next to the engine, run with the existing `tsx` dev dependency
(`npm run test:catan`), including a bots-only fuzz simulation with conservation invariants.

---

## Pixel Catan Implementation Plan

| ID | Milestone | Delivers | Status |
|---|---|---|---|
| CAT0 | Engine contract | types, constants, geometry, rng, helpers, dispatcher skeleton | Done |
| CAT1 | Core loop | board generation, setup phase, roll/production, building, end turn, VP | Done |
| CAT2 | Robber | 7-roll discards, robber move, steal | Done |
| CAT3 | Development cards | buy/play all types, one per turn, Largest Army | Done |
| CAT4 | Longest Road | graph walk, breaks at opposing buildings, award and tie rules | Done |
| CAT5 | Trading | bank 4:1, harbours 3:1 and 2:1, domestic trade with bots | Done |
| CAT6 | Bots | full heuristic turn logic and trade acceptance | Done |
| CAT7 | Board UI and `/catan` route | pixel board, hand, actions, dialogs, log, bot pacing, shelf launch | Done |
| CAT8 | Persistence and polish | save/resume, new game (3 or 4 players), game-over, rules panel, keyboard | Done |
| CAT9 | Verification | rules audit, fuzz simulation, type-check/lint/build, browser playthrough | Done |

### Build log
- Built with DeepSeek (`deepcode`) subagents orchestrated from Claude Code: 4 parallel module builders, an adversarial
  rules audit and fix pass per module, integration fuzzing, bot AI, board renderer, game shell, polish, final review.
- Audit outcomes: setup piece-limit guard (fixed), exhausted road-building phase guard (fixed), unknown resource keys
  accepted by `isResourceCounts` (fixed at the helper), event payload aliasing (fixed in integration). Disputed and
  kept: the bank-shortage exception (the official rules give the sole affected player the remainder) and a ring road
  cut once by an opposing settlement (still a continuous 6-segment road).
- Polish from browser testing: larger settlements/cities, readable 2:1 harbour swatches, harbour labels clear of
  pieces, natural target labels, second-person narration for the human, action-named build buttons, clear table
  headers, real modal dialogs (focus trap, inert background, Escape), bots use public information only for Monopoly.
- Final review fixes: strict zod validation of saved games plus an error boundary that resets a bad save; Road
  Building only offered when the engine accepts it; a way back to the room from the first-load dialog; safe template
  filling for user-entered names. Rejected: hiding bot discard composition (discards are public).
- Verification: 145 tests (`npm run test:catan`) including 300 random-legal-action fuzz games (about 249k actions)
  with resource, piece and card conservation invariants and 240 bots-only games that all finish (about 85 turns on
  average); `tsc`, lint and `next build` clean; production-build browser playthrough of setup, rolling, trading,
  discarding, stealing, Year of Plenty, cities, winning, save/resume, tampered and corrupt saves, focus trapping and
  the shelf launch.
- Known follow-up (outside this feature): the site CSP blocks `eval`, so `next dev` renders blank pages; test with a
  production build until that is fixed.

### Task detail
- **CAT0** Write the shared contract first so the rule modules can be built in parallel against it.
- **CAT1** Tiles 4 lumber / 4 wool / 4 grain / 3 brick / 3 ore / 1 desert; tokens 2,3,3,4,4,5,5,6,6,8,8,
  9,9,10,10,11,11,12 with 6/8 never adjacent (reshuffle until valid); robber starts on the desert;
  9 harbours (4 × 3:1, one 2:1 per resource) on fixed perimeter edges. Seat order shuffled. Setup
  is snake order; the second settlement pays one of each adjacent resource. Production pays 1 per
  settlement and 2 per city, skips the robber hex, and applies the bank shortage rule (a resource
  the bank cannot cover in full goes to nobody, unless only one player is owed it, who gets what
  is left).
- **CAT2** On a 7, every player above 7 cards discards half (rounded down), then the roller must
  move the robber to a different hex and steals one random card from an adjacent opponent with
  cards (auto-steal when there is exactly one candidate).
- **CAT3** Cards bought this turn cannot be played; at most one card played per turn, before or after
  the roll; VP cards are never played and count immediately. Road Building places up to 2 free
  roads; Year of Plenty takes 2 from the bank; Monopoly takes every card of one resource.
- **CAT4** Longest path over a player's roads without reusing an edge, not passing through an
  opposing building. Holder keeps ties; a strictly longer road takes it; when the holder is broken
  and no longer longest, a unique leader at 5+ takes it, otherwise nobody holds it.
- **CAT5** Maritime rate per resource is 2 (matching 2:1 harbour), 3 (any 3:1 harbour) or 4. Domestic
  trades must exchange non-empty, non-overlapping sets; bots decide via `botAcceptsTrade`.
- **CAT6** Setup by pip count, diversity and harbours; robber targets the leader; discards keep the
  next build; trades only when they complete a build this turn; never stalls.
- **CAT7** Board canvas, overlay buttons for legal vertices/edges/hexes, players panel, hand,
  dev cards, dice, discard/steal/trade/year-of-plenty/monopoly dialogs, event log, bot actions paced
  ~500 ms, room palette and pixel font, shelf box opens `/catan` in a new tab.
- **CAT8** Resume from `catan-save-v1` (versioned, invalid saves discarded); new game with 3 or 4
  players; winner screen with final scores; rules reference; keyboard-reachable controls.
- **CAT9** Independent rule audit against the official base-game rules; seeded fuzz games with
  resource/piece conservation invariants; `npm run type-check && npm run lint && npm run build`;
  full game played in the browser.
