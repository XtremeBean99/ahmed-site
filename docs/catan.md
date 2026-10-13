# Pixel Catan (`/catan`)

Moved out of CLAUDE.md on 13 October 2026, verbatim.

Offline singleplayer Catan (full base-game rules) against 2 or 3 bots, opened in a new tab by the room's shelf
Catan box; playable on desktop, tablet and phone. Not under `/games` (that path 301s to `/`). Design and task
log: `docs/archive/todo-2026.md` (CAT0-CAT9 v1, CAT10-CAT16 v2, CAT30-CAT41 v3 overhaul, September 2026).
- **Engine** `src/lib/games/catan/`: pure, JSON-serialisable `GameState` (version 2); `engine.ts` exposes
  `createGame`, `validateAction`, `applyAction` (clones everything except the append-only event log, which it
  shares), `playersToAct`, `isUndoable`. Rules live in `setup.ts`, `turn.ts`, `robber.ts`, `devcards.ts`,
  `longest-road.ts` and `trade.ts` against the `Handler` contract in `types.ts`; board topology in
  `geometry.ts` (19 hexes, 54 vertices, 72 edges). All randomness goes through the seeded `rng.ts` stored in
  state, so a seed plus actions replays exactly (the tutorial uses `scriptedRolls`).
- **Game settings** (`state.settings`): points to win 8-13, friendly robber (players with 2 or fewer public VP
  cannot be blocked or robbed while another hex is legal; `legalRobberHexes`), board preset (`balanced`:
  rejection-sampled fair boards; `random`; `starter`: a fixed map; `presets.ts`), bots trade. `Player.level`
  is Easy, Normal or Hard.
- **Trade offers** are a phase: `proposeTrade` (to one or more players, at most 5 per turn), `respondTrade`
  (accept, decline or counter; carries its actor like `discard`), `confirmTrade`, `cancelTrade`. Terms are
  always from the proposer's side. The old instant `domesticTrade` action is deprecated (no UI uses it).
- **Stats** (`state.stats`, `stats.ts`): dice histogram, production by player, robber losses, trades, dev
  cards and VP per turn, counted in `pushEvent` as the game runs (never rebuilt from the 200-event log).
- **Saves**: `catan-save-v2` (strict zod schema typed against `GameState`); a `catan-save-v1` save migrates
  on first load (stats marked `partial`); an unreadable save is copied to `catan-save-quarantine` before it
  is removed; a newer version is left alone. Tutorial: `catan-tutorial-v1` plus `catan-tutorial-progress-v1`.
  Prefs `catan-prefs-v1` (bot speed, tooltips, sound, volume, animations, last New game setup).
- **Rule decisions**: bank shortage gives the sole affected player the remainder; a ring road cut once by an
  opposing settlement still counts its full length; a 7 still forces discards under the friendly robber.
- **Bots** `ai/` (`index.ts` exports `chooseBotAction(state, bot, { level? })`, `fallbackAction`,
  `botAcceptsTrade`): always legal, deterministic, public information only, never advance `state.rng` (Easy's
  variety comes from a read-only hash). Normal plans roads by BFS and orders builds; Hard adds a one-ply engine
  lookahead in setup and the main phase. Bots propose 1:1 or 2:1 trades when one or two cards short (never to a
  player within 2 VP of the target), confirm with the fewest-VP acceptor, and Normal/Hard counter the human's
  offers. They ask the human at most once per turn, only for cards the human probably holds, and not within a
  round of a refusal. Measured (`ai/strength.longtest.ts`): Hard wins 40.8% against three Normals, Normal 55%
  against three Easys. Hints use the Hard bot's choice.
- **UI** `src/components/catan/`: `useCatanLayout()` (`layout.ts`) picks `wide` (landscape >= 1100 px: opponent
  cards, bank and log | board | dice, your panel, hand, development cards, build grid, pinned turn actions),
  `medium` (landscape 700-1099: opponent strip, board, right column, log drawer) or `stack` (phones and portrait
  tablets: top bar, opponent strip, board, hand strip, action bar, bottom sheets). `CatanGame` composes
  `useCatanController` (built from `useCatanGame` for state, saves and undo; `useBotLoop` for pacing, the
  900 ms post-roll pause and skip-to-my-turn; pure `selectors.ts`), `useShortcuts` (R, E, 1-4, T, P, U or
  Ctrl+Z, H, L, +/-/0, Escape, ? overlay) and `useEventAnnouncer` (aria-live narration). Dialogs (`ModalDialog`)
  become full-screen sheets on the stack layout; buttons grow to 44 px on touch. Layering rule: dialogs (z-index 70)
  sit above sheets (60), the log drawer and popovers (55); opening a dialog, or an offer reaching you, closes any
  sheet, drawer or menu in the same render (`interrupted` in `CatanGame`), and `useModalBehavior` ignores panels
  inside an inert subtree, so two focus traps never fight.
- **Board** (`BoardCanvas.tsx`, `pixel-art.ts`, `board/`): an integer scale in device pixels for the island and
  harbour ring (`board/camera.ts` `fitScale`), so it renders at 3x on 1280-1408 px laptops and pixel-exact on
  phones; a tiled 32x32 sea fills the whole board area with a slow drift and a drawn shoreline. Wheel, pinch,
  double-tap and button zoom with drag to pan; the viewport uses `overflow: clip` so focus can never scroll
  it. Mouse clicks on a target act at once; on touch a tap selects and a Place/Cancel pair confirms; long-press
  shows the hover info. Static, pieces and overlay canvases; `viewRef` (`BoardView.toClient`), `highlightHexes`,
  `robberHex` and `hiddenPieces` serve the animation layer.
- **Game feel** (`effects/`): pure `effectsFor` turns new events into effects: tumbling dice, pulsing
  producing hexes and resource icons flying to each receiver, the robber hopping, steals, pop-in builds,
  banners, confetti; batches over 12 events collapse to a summary. Web Audio sounds in `sound.ts` (no files).
  Reduced motion or the Animations setting keeps banners, highlights and sound but no movement.
- **Trading UI** (`trade/`): `TradePanel` (Bank tab with harbour rates; Players tab with steppers, recipients
  and live replies, counters and withdraw) and `IncomingOffer` (alert banner for bot offers). **Results**
  (`results/`): VP breakdown and SVG charts (dice against expected, production, VP over time, highlights).
- **Art (owner redraws all of it later)**: every board and UI graphic is a drop-in PNG listed in `sprites.ts`
  (board) and `ui-sprites.ts` (cards 24x34, dice 16x16, icons 8x8). Source art in `assets/pixel-art/catan/`
  with `SPEC.md` (exact sizes, anchors and a "Changed in v3" list: 32x32 sea tile, 13x13 tokens, 11x11
  settlement, 15x13 city, 9x13 robber); `npm run catan-sprites` validates and copies to `public/catan/`;
  `npm run catan-sprites:export` regenerates the procedural placeholders (`--force` to overwrite). The owner
  allowed the v3 size changes (25 September 2026); ask before changing sizes or names again.
- **Tutorial** (`tutorial.ts`, `TutorialCoach.tsx`, copy in `en.ts` `catan.tutorial.steps`): a scripted
  14-step lesson on every layout (the coach docks above the action bar on phones and opens the Build or Cards
  sheet when a step needs it); it resumes after a reload, and exiting never touches the normal save.
- **Tests**: `npm run test:catan` (about 350 tests in 15 s: rules, trade, stats, saves and migration, presets,
  bots, selectors, undo, shortcuts, effects, results, layout maths, board camera and layers);
  `npm run test:catan:long` (300-game fuzz with conservation invariants, bots-only runs, bot strength
  thresholds; a few minutes).
- **Local testing**: `next dev` works (the CSP adds `unsafe-eval` only in development); after moving or
  deleting modules restart it, since webpack can cache a stale path. A production check is
  `npm run build && npx next start`.

---
