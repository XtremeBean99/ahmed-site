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

---

## APPROVED DESIGN — Pixel Catan v2 (cards, tutorial, clarity)

Requested by the owner 14 September 2026 after v1 shipped. The owner will redraw every sprite later, so all art is
drop-in PNG at fixed sizes (`assets/pixel-art/catan/SPEC.md`).

| ID | Item | Status |
|---|---|---|
| CAT10 | Redrawable art: integer hex grid (identical 38x43 tile mask), board sprite manifest, template export, `npm run catan-sprites` | Done, deployed |
| CAT11 | Pacing and clarity: bot speed, skip to my turn, disabled-action reasons, pip counts on placement, dice history, per-phase bot fallback, trade offers no longer reveal bot hands | Done, deployed |
| CAT12 | Mobile gate false positive on Firefox touch-capable desktops (`any-pointer: fine`) | Done, deployed |
| CAT13 | UI sprite manifest (`ui-sprites.ts`): cards 24x34, dice 16x16, icons 8x8; `PixelSprite`, shared `Tooltip`, `tooltips` pref | Done |
| CAT14 | Card and icon placeholder art, board hover information, board key/legend | Done |
| CAT15 | Cards in the game (hand stacks, playable dev cards, opponent card backs, award cards, click-to-discard), dice viewer, aligned players table, highlighted log, settings menu with tooltip toggle, tooltips everywhere | Done |
| CAT16 | Tutorial mode (scripted deterministic 3-player lesson with coach marks and move restrictions) and Hint button | Done |

Browser verification fixes applied by the orchestrator: sidebar overflow (scrollable middle, pinned status and action bar, hand as one row of card stacks); `Panel` dropped `data-tutorial` attributes, breaking spotlights; tutorial Next could skip action steps and desync the scripted game; tutorial dialogs showed fabricated zero counts (now real counts with explicit step text); hints enabled after the lesson; "1 cards".
Known limitation: reloading mid-tutorial returns to normal mode (the lesson restarts from New game).

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

---

## APPROVED DESIGN — Snake (desk app)

Requested by the owner 23 September 2026: "add the snake game… as a desktop icon/game". Built on the
existing Minesweeper pattern rather than a new route, so it lands as one more app on the desk monitor.

| ID | Item | Status |
|---|---|---|
| SNK1 | Pure engine `src/lib/games/snake-engine.ts`: `createGame`/`turn`/`step`/`placeFood`/`tickMs`, injectable rng, no DOM | Done |
| SNK2 | `DeskSnake.tsx`: square 14x14 board at 16 px cells, window-level key handling, pause/overlay, best score | Done |
| SNK5 | Owner feedback 23 Sep: board squared off (was 24x14), food redrawn as a pixel apple, and the bottom-row misalignment fixed (`box-sizing: content-box`, see below) | Done |
| SNK3 | Desk wiring: `snake` screen mode, `ICON_SNAKE`, shortcut entry, `snake` discovery, `desk.snakeApp` copy | Done |
| SNK4 | `npm run test:snake` (9 node:test cases) + `type-check`, `lint`, `build` clean | Done |

### Rule decisions
- **Walls kill.** No wrap-around; the classic Nokia reading, and it keeps the board honest at 14x14.
- **The board opts out of border-box.** `globals.css` sets `box-sizing: border-box` for everything, which
  shrinks the board's padding box by its 2 px border while the absolutely positioned cells and the grid
  gradient still assume the full size: the bottom row and right column drift by 3 px. `content-box` on
  the board is the fix. Do not remove it, and re-check the alignment if the border width ever changes.
- **Turn queueing is single-slot and validated against the *applied* heading**, not the queued one, so
  two presses inside one tick (right, then up, then left) can never fold the snake back into itself.
- **The tail cell is legal to enter** on the tick it is vacated, unless the snake is growing that tick.
- **Speed is derived from score**: `tickMs = max(70, 140 - score * 4)`, so the interval is rebuilt only
  when the score changes, never on every render.
- **Filling the board wins** rather than hanging in `placeFood` looking for a free cell that is gone.
- **Auto-pause when the tab hides**, so a backgrounded tab does not quietly kill the run.

### Deliberately skipped
No leaderboard (localStorage best only, like Minesweeper and Breakout), no touch D-pad (the room is
desktop-only behind `MobileGate`), no sound (Minesweeper has none either), no new sprite art: the icon
is inline SVG rects in `DeskIcon.tsx` like the other hand-drawn ones.

---

## APPROVED DESIGN — Desk arcade (Blackjack, Solitaire, Pong, Breakout)

Requested by the owner 25 September 2026: "fully implement blackjack, solitaire, pong and breakout, spend a
dedicated amount of time on the visuals so they are perfect, and make them desktop icons". Answers to the
kick-off questions: games run **on the desk monitor with a Full screen button**; **room-palette retro** look;
Pong has **a CPU opponent and local 2-player**; **soft synthesized SFX** that obey Settings.

### Decisions
- **Four new desk apps** on the Minesweeper/Snake pattern: screen modes `blackjack | solitaire | pong | breakout`,
  one desktop shortcut each, a discovery each (26 total), copy in `en.ts` under `desk.<game>App`.
- **Desktop grid is now 5x3** (it was 3 columns and already clipped the last row): about the site, then tools
  and media, then a full row of games (Snake, Blackjack, Solitaire, Pong, Breakout).
- **Full screen** uses the real Fullscreen API on the app's root (`ArcadeFrame`), so React state survives the
  switch; the fixed 536x308 app scales to fit. The browser's Escape leaves full screen only (DeskView's Escape
  ladder ignores the key while an element is full screen).
- **One visual system** in `DeskArcade.tsx`: `ARCADE` palette, `FELT_STYLE` (muted felt, weave, vignette),
  `CrtOverlay` (scanlines, vignette), `ArcadeButton` (cream bevel like "To Room", or the dark bubble),
  `ArcadePanel`, `ArcadeOverlay`, `ArcadeStrip` (clock, Full screen, Desktop, Room), `useCanvasScale` (canvas
  backing store at device pixels through the stage scale and full screen).
- **Cards are pixel art** painted by `card-art.ts` (45x63, rank + suit index side by side so tableau strips stay
  short, classic pip layouts with lower pips inverted, double-headed court portraits, rust lattice back) and
  shown by `PlayingCard` as cached PNG data URLs with `image-rendering: pixelated`. `cards.ts` holds the deck,
  seeded shuffle and names.
- **Sound** is `tone(name, pitch?)` on `useSfx()`: Web Audio blips and noise bursts, no files, gated by the SFX
  toggle and volume.

### Games
- **Blackjack**: 6-deck shoe reshuffled past 75 %, dealer stands on soft 17, blackjack pays 3:2, dealer peeks
  on an Ace or ten, insurance 2:1, double on any two cards (and after a split), split up to 4 hands (split Aces
  get one card), chips 5/25/100/500, bankroll 1000 saved locally with a re-buy, best bankroll as the high score.
- **Solitaire**: Klondike, Draw 1 or Draw 3, drag and drop plus click-to-move, double-click to a foundation,
  unlimited undo, standard scoring with a timer and time bonus, auto-finish, the bouncing-cards win.
- **Pong**: 1 player vs CPU (Easy/Normal/Hard) or 2 players on one keyboard (W/S and Up/Down), first to 7,
  mouse control for player one, serve countdown, ball speeds up per rally.
- **Breakout**: the pure engine is reworked for the desk (seeded, brick scoring, levels with tough and steel
  bricks, power-ups), mouse or keys, lives, best score under `breakout-desk-best`.

## Desk arcade Implementation Plan

| ID | Item | Owner | Status |
|---|---|---|---|
| ARC0 | Shared contract: `cards.ts` (+test), `card-art.ts`, `PlayingCard.tsx`, `DeskArcade.tsx`, `tone()` SFX, storage keys + `readJson`/`writeJson`, discoveries, `en.ts` copy, icons, 5x3 grid, stub apps, DeskView/Room wiring, `npm run test:games` | orchestrator | Done |
| ARC1 | Blackjack engine + tests + `DeskBlackjack.tsx` | deepcode agent | |
| ARC2 | Solitaire engine + tests + `DeskSolitaire.tsx` (win cascade) | deepcode agent | |
| ARC3 | Pong engine + tests + `DeskPong.tsx` (CPU + 2P) | deepcode agent | |
| ARC4 | Breakout engine rework + tests + `DeskBreakout.tsx` (levels) | deepcode agent | |
| ARC5 | Integration: type-check, lint, all tests, production build | orchestrator | |
| ARC6 | Visual pass: 1408x768 and full-screen screenshots of every state, polish until right | orchestrator | |
| ARC7 | Card art polish (aces, court portraits) | orchestrator | |
| ARC8 | Docs (CLAUDE.md v20), commit, push, deploy, production check | orchestrator | |

---

## APPROVED DESIGN — Terminal overhaul (real bash, nano, vim)

Requested 25 September 2026. Replaces the ten-command `DeskTerminal` toy with a Linux-like shell.

### Decisions
- **Client-only virtual machine.** No server, no network. Files live in a `VFS` (`src/lib/terminal/vfs.ts`), persisted in
  `localStorage` (`room-terminal-fs-v1`, 1.5 MB cap), history in `room-terminal-history-v1`.
- **Desktop = `~/Desktop`.** Files saved there appear as icons on the pixel desktop (`DeskDesktop` `files` prop, refreshed when the
  desktop is shown); clicking one opens it in nano inside the Terminal. `download FILE` hands a file to the browser for the real
  desktop. The Terminal stays konami-only (no icon), per the existing design.
- **Bash is an async tree-walking interpreter** (`shell/`): full quoting/expansion, arrays, arithmetic, if/for/while/case,
  functions, pipes, redirections, heredocs, `$(...)`, aliases, `~/.bashrc`. Stages of a pipeline run sequentially with the
  previous output as the next stdin. Step budget + abort signal so `while true` cannot hang the tab.
- **Commands** (`commands/*.ts`, merged in `commands/index.ts`, which also owns `help` and `man`): files, text, sed, awk, system, fun.
- **Editors are pure state machines** (`editors/nano.ts`, `editors/vim.ts`) returning a styled character grid; `TermEditor.tsx`
  draws it in a measured monospace grid and swallows Escape so vim does not close the desk.
- **Known gaps:** no real background jobs, no symlinks, no Ctrl+R history search, nano's Ctrl+W is stolen by the browser (use F6 or Alt+W).

### Tasks
- TRM0 foundation (types, vfs, glob, regex, printf, seed, ansi, session): done, `npm run test:terminal`.
- TRM1 shell, TRM2 files, TRM3 text, TRM4 sed+awk, TRM5 misc, TRM6 fun, TRM7 nano, TRM8 vim: built by deepcode agents (`.agents-work/term-*.md`), verified here.
- TRM9 UI (`DeskTerminal.tsx`, `TermEditor.tsx`), desktop icons, CLAUDE.md notes.


---

## APPROVED DESIGN — Pixel Catan v3 (overhaul)

Requested 25 September 2026: "plan and implement a full overhaul of the catan game, improving it in any and every
way you can; ask refining questions then proceed autonomously". Branch `feat/catan-overhaul` in the worktree
`ahmed-site/.claude/worktrees/catan-overhaul` (its `node_modules` is a junction: `cmd /c rmdir` it before any
cleanup). Each deepcode builder gets its own worktree `catan-<key>` on branch `catan/<key>`, merged back after review.

### Owner decisions (refining questions)
- **Bots only.** No hot-seat or online play.
- **Board art sizes may change** (the redraw has not started); `assets/pixel-art/catan/SPEC.md` and the template
  export stay the contract.
- **Catan must work on tablets and phones.** Another session makes the rest of the site mobile friendly, so this
  overhaul touches only Catan-owned files (`src/components/catan/`, `src/lib/games/catan/`, `src/app/catan/`,
  Catan art and scripts, the `catan` block of `en.ts`), plus the shared `tsconfig.json` exclude.
- **Execution:** Claude Workflow for design, review and verification; deepcode for bulk implementation.

### Goal
Turn /catan from a correct engine behind a dense, debug-style UI into a polished, lively board game: a big board
over open sea, feedback for every event, bots that trade with you, real game options, an end-game stats screen,
and layouts from a 390 px phone to a 1920 px monitor, in the room's pixel style.

### Findings that shaped it
- Rules audit (Claude): no rule bugs in the engine. Two tutorial bugs (a stacked, unshuffled deck after the lesson;
  exiting the tutorial deleted the normal save). 85% of `applyAction` went to deep-cloning the 200-event log (suite
  216 s). A strict v1-only save schema would have deleted every save on the first new field. The win condition had
  no test.
- Layout maths: the island plus harbour ring is 258x230 logical px; choosing an integer scale in device pixels and
  letting the sea fill the board area fits the board at 3x on 1280x720 to 1408x768 laptops (2x today), 4x at
  1920x1080, and fills phones by width. A bigger hex lattice would make 768 px laptops worse, so the lattice stays.
- Contrast: muted text (4.2:1), red danger text (2.8:1) and red/blue player-coloured text (about 2.5:1) failed AA;
  replaced (all at least 4.5:1).
- Random boards clump: 77% have three or more same-terrain hexes together; hence the balanced preset.

### A. Engine (done: CAT30, CAT31)
Game settings in state (VP to win 8-13, friendly robber with a legal-hex fallback, board preset balanced / random /
starter, bots trade); bot level per player; a trade-offer phase (propose to several players, accept / decline /
counter, confirm, cancel, per-turn cap); per-game stats kept as events are pushed; scripted tutorial rolls; save v2
(`catan-save-v2`) with a validated v1 migration and quarantine instead of deletion; `isUndoable`; event log shared,
not deep-cloned; default tests 16 s, long fuzz in `test:catan:long`.

### B. Board and art (CAT32)
Device-pixel integer fit of the island and harbours, tiled sea filling the board area with a slow drift, a drawn
shoreline, harbour plates 6 px closer; camera with wheel, pinch, double-tap and buttons, drag to pan; tap-to-select
then confirm on touch, long-press info; static / pieces / overlay layers; hex highlight, robber and hidden-piece
overrides and a board-to-screen view for animations; placeholder art v2 (tiles with trees, sheep, wheat, kiln,
peaks, dunes; 13x13 tokens with pips; bigger settlement, city and robber; 32x32 sea tile; redrawn cards and icons).

### C. Layout and controller (CAT33)
Three layouts from `useCatanLayout()`: wide (opponents and log | board | dice, hand, cards, build grid, actions),
medium (opponent strip, board, right column, log drawer) and stack (top bar, opponent chips, board, hand strip,
action bar, bottom sheets). Large cards at 2x, a status banner, a whole-game dice histogram, undo for builds and
bank trades, keyboard shortcuts with a help overlay, live-region narration, the tutorial exit fix, no mobile gate.
The controller splits into game state, bot loop and pure selectors.

### D. Dialogs (CAT34)
New game dialog with name, colour, players, bot level, board, points to win, friendly robber and bot trades; settings
with sound, volume and animations; a sectioned rules reference with cost cards and shortcuts; big, touch-friendly
discard, steal and play-card dialogs; tooltips on long-press.

### E. Bots (CAT35)
Easy / Normal / Hard; bots propose trades to the human and to each other with safeguards (never feed a player near
the target, offer caps, fair ratios) and counter human offers; stronger play from measured weaknesses; deterministic,
never touching `state.rng`, under 30 ms per decision.

### F. Game feel (CAT36)
Animated dice, producing hexes pulse, resource cards fly from hexes to players, the robber hops, steals fly between
players, pieces pop in, award and turn banners, bot actions shown, Web Audio sounds; all decorative motion off under
reduced motion or the animations setting.

### G. Trading and results (CAT37, CAT38)
A trade panel for the human's offers (bank and harbour rates, offers to one or all bots with live replies and
counters) and an incoming-offer banner for bot offers. A results screen: winner, VP breakdown, dice histogram
against expectation, production by player, VP timeline, robberies and trades; rematch or new game.

### H. Tutorial (CAT39)
The lesson rewritten for the new layout and copy moved to `en.ts`, resumable after a reload.

### Deliberately skipped
Human multiplayer; 5-6 player extension and expansions; site-wide mobile work; per-seat bot levels in the dialog (the
engine stores a level per player; the dialog sets one level for all bots); structured rule-violation codes in the
engine (its messages are only shown when the UI already prevented the action).

---

## Pixel Catan v3 Implementation Plan

Every task is a deepcode builder in its own worktree with a task file in `.agents-work/` (gitignored), reviewed and
verified by the orchestrator (tests, type-check, lint, code review, browser checks at desktop, tablet and phone
sizes) before merging into `feat/catan-overhaul`. Task files hold the full specification; the shared briefing is
`.agents-work/catan-context.md` and the UI seams are in `.agents-work/plugin-contract.md`.

| ID | Wave | Task | Status |
|---|---|---|---|
| CAT30 | 0 | Engine contract types, defaults, trade stubs; tsconfig excludes `.claude` and `.agents-work` | Done (orchestrator) |
| CAT30b | 0 | UI kit: `useCatanLayout`, accessible palette, button sizes, full-screen dialogs on phones, prefs v2 | Done (orchestrator) |
| CAT30c | 0 | Seams: `NewGameSetup` new-game flow, settings props and inline variant, Web Audio `sound.ts` | Done (orchestrator) |
| CAT31 | 1 | Engine v2: speed, settings, presets, friendly robber, trade offers, stats, save v2, tutorial fixes, undo | Done, merged |
| CAT32 | 1 | Board renderer and placeholder art v2 | Done, merged (+ fixes: zoom scroll, plates clear of cities, visible touch targets) |
| CAT33 | 1 | Layouts, panels, controller split, undo, shortcuts, placeholders | Done, merged (+ typed board props, muted disabled actions, hand grid) |
| CAT34 | 1 | Dialogs, game options, settings, rules | Done, merged |
| CAT35 | 2 | Bots: levels, trade proposals and counters, stronger play | Done, merged (+ offers to the human throttled: 6.5 per game) |
| CAT36 | 2 | Game feel: EffectsLayer animations, sounds, narration | Done, merged |
| CAT37 | 2 | Trade panel and incoming offers; remove the old `domesticTrade` path | Done, merged (+ the one bot loop answers the human's offers) |
| CAT38 | 2 | Results screen with stats charts, rematch | Done, merged (+ a 7 is never the luckiest number) |
| CAT39 | 3 | Tutorial for the new layout, copy in `en.ts`, resume after reload | Done, merged |
| CAT40 | 4 | Claude Workflow review (correctness, UX, accessibility, performance) and fixes | Done (deepcode and Claude reviews, all real findings fixed) |
| CAT41 | 4 | Docs (CLAUDE.md Catan section, SPEC.md), final verification, merge | Docs and verification done; merge awaits the owner |

### Build log
- 25-26 September: refining questions answered; audits run (the Claude rules audit completed; the UI, rendering
  and bots audits hit usage limits three times and were replaced by the orchestrator's own measurements, and the
  deepcode audit stopped when the DeepSeek balance ran out, since topped up).
- CAT31 review fix: a migrated save keeps the v1 event counter, so event numbers never go backwards.
- Wave 1 browser pass (1408x768, 1024x768, 390x844 touch): board at 3x, 2x and k=3 device px respectively, pixel-exact;
  setup, rolling, building, undo, bot turns and the phone's tap-then-confirm placement all work. Fixed on the way: the
  zoomed board viewport scrolled when a button took focus; two harbour plates sat under cities on their corners;
  touch targets were nearly invisible (the ring pulse faded to nothing); disabled End turn looked pressable; the hand
  overflowed the 270/280 px columns; rapid zoom clicks lost a step.
- Bots: Hard 40.8% against three Normals, Normal 55% against three Easys, 100% against random; bots now ask the
  human at most once per turn, only for cards the human probably holds, and not within a round of a refusal.
- Waves 2 and 3 browser pass (same three sizes): dice and production animations, bot-to-bot trades, the trade panel
  with live replies and counters, a forced 7 (discard, robber, steal) from an injected state, the results tabs, the
  tutorial resuming after a reload and exiting without touching the normal save, the phone trade sheet and coach.
  Fixed on the way: the trade panel paused the bot loop and ran its own reply timer (now the one bot loop answers
  offers at the chosen speed); a 7 could be named the luckiest number; hex targets drew rings over the number tokens
  you choose the robber by; the phone action bar announced the status twice.
- CAT40 deepcode second-opinion review: two real bugs fixed. The Trade button needed a legal bank trade, so a player
  holding cards but no 4:1 could never open player offers; the robber targets ignored the friendly robber, offering
  hexes the engine then refused. A reported tutorial save race was a false positive (one batched render, one effect).
- CAT40 Claude review (two reviewers: interaction flows; UX, accessibility and performance; the first four-reviewer
  run hit session limits). Fixed, and checked in the production build at 1408x768 and 390x844:
  - Phones: choosing Road, Settlement or City left the Build sheet open over an inert board; dialogs (Play card, Rules,
    New game, Discard, Steal, results) opened underneath sheets, the log drawer and popovers, whose focus traps then
    fought the dialog's. Dialogs now sit above every transient layer, a dialog or a pending offer closes sheets,
    drawers and menus in the same render (so the offer banner can take focus), and a panel inside an inert subtree
    no longer traps Tab or takes Escape (the Menu popover left Tab stuck in New game on desktop too).
  - Phones had no Undo control (now in the top bar), an ungated Trade button (now follows `canTrade`), a 24 px dice
    button named only "Dice" (now 44 px, "Roll dice" or the rolled values), 40 px opponent chips (now 44 px) and
    "Esc cancels" as the placement prompt (now a touch variant).
  - Undo re-read the whole log to screen readers as "N events" and left the undone action's banners running.
  - Contrast: red text (the robber, a rolled 7) was 1.80:1, log resource words 2.10-3.27:1, log player names in red
    and blue about 2.5:1 (found while checking), the +N gain badge 1.64:1; all now at least 4.5:1.
  - Screen readers: trade offer and rules costs read no resources, opponent stats were bare numbers, and the status
    banner announced every bot phase change on top of the event narration (it now speaks only prompts for you).
  - The phone Cards sheet showed its heading twice.


---

## APPROVED DESIGN — Mobile, full optimisation of the room and desk (`/`)

Requested 28 September 2026: "Full optimise the main site for mobile, ask refining questions first then proceed
using deepcode agents". Branch `feat/mobile` in the worktree `ahmed-site/.claude/worktrees/mobile` (its
`node_modules` is a junction: `cmd /c rmdir` it before any cleanup). Each deepcode builder gets its own worktree
`mob-<key>` on branch `mobile/<key>` off `feat/mobile`, merged back after review. Catan is out of scope (done in v3).

### Owner decisions (refining questions)
- **Portrait-native.** On a portrait phone the monitor becomes a tall portrait screen and every desk app gets a
  portrait layout (the landscape 536x308 screen can only render at about 0.7x on a 390 px wide phone).
- **Monitor bezel.** The portrait screen sits inside a thin pixel bezel in the monitor's colours with the green
  power LED in the chin, so it still reads as the computer; the room is one tap away (← Room).
- **Terminal stays desktop-only** (konami code). If a phone does open it (a `~/Desktop` file), it must render and
  accept the phone keyboard, nothing more.
- **Music untouched** (no re-encoding). Covers and sound effects still get lighter.

### Findings that shaped it (live site at 390x844, 28 September)
- Phones land on the desk README (deliberate, `55ddfae`) but the screen is 378x217 px: README text about 7-8 px,
  desktop icons and labels tiny, strip buttons about 20 px tall; most of the phone is desk art or black.
- Landscape phones are fine for size (the screen renders at about 1.1-1.2x, larger than on a 1408x768 laptop).
- Snake has no touch input at all; Pong is keys plus mouse; iPhone has no element full screen (the button hides);
  the guestbook inputs are under 16 px so iOS zooms the page; room tooltips are mouse-hover only; the room's
  "Click around to explore" hint overlaps the music bar; the NowPlaying volume slider does nothing on iOS (media
  volume is read-only there).
- The `/` page chunk is 699 KB decoded (1.2 MB of JS in total): every desk app and the terminal engine ship with
  the landing page. Each sound effect is downloaded 3-4 times at startup (a pool of `new Audio()` elements, about
  600 KB); cover thumbnails shown at 36 px are 20-300 KB JPEGs.

### Goal
A phone visitor in portrait gets a readable, touch-first version of the same site: the README landing, the pixel
desktop, every app and game playable with fingers, the room explorable by drag and tap, and a lighter first load.
Desktop at 1408x768 and 1920x1080 stays pixel-identical; landscape phones and tablets keep the diegetic desk.

### A. The portrait screen (the contract, MOB0)
- **Mode.** `isPortraitPhone(vw, vh, mobile)`: mobile (the existing `isMobileViewport`) and `vh > vw` and the
  landscape screen would render below 0.9x (`min((vw-12)/536, (vh-12)/308) < 0.9`). So 360-430 px phones in
  portrait get the portrait screen; iPads, foldables and every landscape viewport keep today's desk.
- **Logical screen.** 320 logical px wide, `h` logical px tall (between 440 and about 700, from the phone), scaled
  as one unit by `s = (available width - bezel) / 320` (about 1.06x on 360 px phones, 1.16x on 390, 1.28x on 430).
  If `h` would fall under 440 (short phones with browser bars), `s` shrinks to fit 440 and the screen centres.
  Apps design in logical px exactly as they do for 536x308, so canvases, pointer maths and pixel coordinates keep
  working. Minimums in portrait: body text 12 logical px (about 14 CSS px), labels 10, tap targets 38 (about 44).
- **Shell.** Full viewport, black, safe-area padding; the bezel (10 px sides, 12 px top, 26 px chin with the LED,
  CSS px, colours sampled from the monitor art) around the scaled screen; a 56 px music bar under the bezel holds
  `NowPlaying embedded` (Room stops rendering its fixed player in this mode). No desk art, desk pan, mouse
  follower, "click again to return" or desk clicks in portrait.
- **Rotation keeps state.** DeskView keeps one element tree in both modes (the screen element never changes
  parent or position among its siblings; the desk art and the bezel are conditional siblings), so rotating the
  phone swaps layouts without remounting the open app or losing a game.
- **Context.** `DeskScreenContext` / `useDeskScreen()` (next to `DeskClockContext` in `ScreenStrip.tsx`) gives
  `{ w, h, portrait }`: `{536, 308, false}` on the desk, `{320, h, true}` in portrait.
- **ArcadeFrame.** New `portrait` prop: the app has a portrait layout. In portrait with the prop, the frame is
  `w x h` and the app lays out from `useDeskScreen()`; without it (compat, for apps not yet migrated) the 536x308
  frame scales to 320 wide and centres, so everything keeps working mid-migration. Full screen reports
  unsupported in portrait (the app already fills the phone). The frame root is `select-none` with no touch
  callout, so long-presses never select text or open menus.
- **ScreenStrip.** In portrait the strip is 44 logical px (clock, title, Desktop, ← Room with `xl` buttons);
  app controls passed as children move to a second 44 px toolbar row under it (scrolls sideways if crowded).
  `ArcadeButton` gains an `xl` size (38 px tall); `StripButton` picks `sm` on the desk and `xl` in portrait.
- **Global touch CSS.** No tap highlight in the room and desk, `touch-action: manipulation` on their buttons,
  `overscroll-behavior: none` on the document so a swipe in a game never pulls to refresh.
- **Inputs.** Every text input and textarea in the desk renders at 16 px computed font size on touch devices so
  iOS never zooms (the logical-px scale is a transform, which iOS ignores for this).

### B. Desk apps in portrait (each builder owns its files)
- **Desktop grid:** 4 columns, larger icons and labels, desktop files row and screensaver sized from `w x h`.
- **README, Legal, Guestbook, Settings, Music, Movie:** they are already flex layouts; portrait bumps type to the
  minimums, makes rows and tabs full-width touch targets, stacks the guestbook form (focused input scrolled into
  view above the phone keyboard), hides the music volume slider where volume is read-only (iOS), and fits the
  video to the width with the controls below.
- **Terminal:** reflows its character grid to the portrait width; inputs at 16 px; no extra-keys row.
- **Snake:** portrait board scaled to the width with a pixel D-pad under it; swipes on the board steer too; on
  touch in landscape the D-pad sits beside the board (the owner's "touchpad for snake" idea).
- **Minesweeper:** bigger cells in portrait and a Reveal/Flag mode toggle (long-press still flags).
- **Paint:** the 107x50 canvas at the full width, tools and a larger palette under it.
- **Blackjack:** dealer at the top, hands in the middle, chips and Hit/Stand/Double/Split as big buttons at the
  bottom; the tutorial dialog fits the portrait screen.
- **Solitaire:** classic phone layout (stock, waste, gap, four foundations over seven columns) with cards scaled
  to fit, more vertical fan room, and tap-to-move (a tap sends a card to its best legal destination; drag stays).
- **Pong:** the court turns vertical in portrait (the engine stays as is; the view transposes x and y): you at the
  bottom, the CPU at the top, drag anywhere on your half; two players hold the top and bottom halves. Touch drag
  works in landscape as well.
- **Breakout:** the engine's court geometry becomes state chosen at game start (landscape 536x280 as today; a
  portrait court about 300 wide) with the same 14-column levels on narrower bricks and speeds scaled to the court;
  drag anywhere to move the paddle. A game started in one orientation keeps its court when the phone rotates (the
  view scales it to fit) until the next game.

### C. The room on phones (MOB8)
Initial pan centred on the monitor; momentum when a drag is released; faint edge chevrons until the first drag;
touch copy for the hint ("Tap things to explore, drag to look around") placed clear of the music bar; tooltips on
tap (touch shows the object's tooltip for about 1.6 s alongside its action; hover handlers only react to a mouse,
which also avoids iOS's tap-twice behaviour when hover changes content); the e-reader in `dvh` with one page,
swipe and tap-zone page turns and 44 px controls; the discoveries badge and popup fitting a 320 px screen.

### D. Lighter first load (MOB0, MOB9)
- Desk apps (all but README and the desktop), the terminal and the e-reader become `next/dynamic` chunks, fetched
  on idle after the landing is interactive (skipped with Save-Data), so opening an app stays instant.
  `desktopFiles` reads the saved file system without importing the terminal engine.
- Sound effects move to Web Audio: each file fetched and decoded once, played through a buffer source with a gain
  node, the context unlocked on the first gesture (iOS), same `useSfx()` API.
- Cover art: originals move to `assets/audio-covers/`; `npm run covers` (ffmpeg) writes 128x128 thumbnails to
  `public/audio/covers/`. The stale cover preload is removed.

### Verification
Viewports: 390x844, 360x800, 430x932 and 375x667 portrait with touch emulation; 844x390 landscape; 768x1024 and
1024x768 tablet; 1408x768 and 1920x1080 desktop (screenshots before and after must match). Every app in portrait at
`h = 440` and `h = 640`, playable by touch; a rotation mid-game keeps state; no horizontal overflow; no input zoom;
`npm run type-check`, `npm run lint`, `npm run build` and every test suite green; First Load JS for `/` measured
before and after.

### Deliberately skipped
Catan; a phone-specific terminal (extra keys row, touch konami); re-encoding the music; new art (the bezel is drawn
in CSS from sampled colours); the archived `(site)` pages; the README "desktop only" note from `ideas.txt` (nothing
visible stays desktop-only now); ideas.txt items other than the Snake touchpad.

---

## Mobile Implementation Plan

> **For agentic workers:** MOB1-MOB8 are deepcode builders (owner's choice), each in its own worktree
> `ahmed-site/.claude/worktrees/mob-<key>` on branch `mobile/<key>` off `feat/mobile`, with a `node_modules`
> junction and a task file in `.agents-work/` (gitignored) that holds the full specification; the shared briefing
> is `.agents-work/mobile-context.md`. The orchestrator (Claude) does MOB0 and MOB9-MOB11 and verifies every
> builder branch (tests, type-check, lint, browser at the viewport matrix) before merging it into `feat/mobile`.

**Goal:** the room and desk at `/` become portrait-native and touch-first on phones, lighter to load, and unchanged
on desktop.

**Architecture:** a pure geometry module picks the mode and the portrait screen size; `DeskView` renders one stable
element tree that is either today's scaled desk or a bezel shell around a 320 x h logical screen; a
`DeskScreenContext` tells every app which screen it has, and `ArcadeFrame`/`ScreenStrip` adapt, with a compat
fallback so unmigrated apps keep working. Each app then gets its own portrait layout in parallel. Desk apps load as
`next/dynamic` chunks prefetched on idle.

**Tech stack:** Next.js 15 App Router, React 19, strict TypeScript, Tailwind 3, Framer Motion 11, `node:test` via
`tsx`, ffmpeg (covers only). No new npm dependencies.

**Spec:** "APPROVED DESIGN — Mobile, full optimisation of the room and desk" above.

### Global Constraints
- Desktop at 1408x768 and 1920x1080 renders pixel-identical to `master`; landscape phones and tablets keep the desk.
- Portrait screen: 320 logical px wide, `h` from 440 to about 700; body text >= 12 logical px, labels >= 10,
  tap targets >= 38 (about 44 CSS px on a 390 px phone).
- Room palette, the pixel font (`PIXEL_FONT`), `ARCADE` colours and kit buttons only; no emoji, no system fonts,
  no rounded pills, no blur shadows; integer logical-px coordinates.
- Copy in `src/lib/i18n/dictionaries/en.ts`, English only, no em dashes.
- Reduced motion disables decorative animation only, never a control or gameplay.
- Every control is a real button (or `ArcadeButton`) with an accessible name and a visible focus ring.
- No new asset files except the cover thumbnails; no new dependencies; CSP-safe (no eval, no external URLs).
- Code style: no semicolons, single quotes, 2-space indent, named exports, no `any`, minimal comments.

### Review Focus
1. Rotating a phone mid-game: the open app keeps its state (no remount) and re-lays out; a Breakout game keeps its
   court until the next game. Pinned by the stable-tree rule in MOB0 and checked in MOB9 (start Snake, rotate
   twice, score and snake unchanged).
2. Short phones with browser bars (375x548 visible): the portrait screen clamps to h = 440, nothing overflows or
   hides the music bar. Pinned by `portraitGeometry` tests in MOB0 and a 375x548 pass in MOB9.
3. Swipes and drags in games (Snake, Pong, Breakout, Paint, the room pan) never scroll the page, pull to refresh or
   select text. Pinned by MOB0's global CSS and each board's `touch-action: none`; checked in MOB9 with touch drags.
4. A lazily loaded app chunk that fails on a flaky network shows a retry message inside the screen instead of
   crashing the page. Pinned by MOB0's screen error boundary; checked in MOB9 by blocking one chunk.
5. The phone keyboard over a focused input (guestbook): the input stays visible and the page does not stay zoomed.
   Pinned by the 16 px input rule in MOB0 and MOB1's scroll-into-view; checked in MOB9 at 390x844 and 390x500.

### Files and owners
| Task | Owns |
|---|---|
| MOB0 | `src/lib/room/desk-screen.ts` (+test), `src/lib/room/media.ts` (+test), `src/lib/room/useStageScale.ts`, `src/components/room/ScreenStrip.tsx`, `pixel-ui.tsx`, `DeskArcade.tsx`, `DeskView.tsx`, `PortraitBezel.tsx` (new), `AppBoundary.tsx` (new), `src/app/globals.css`, `package.json` scripts; Room.tsx lines for NowPlaying placement and the dynamic e-reader |
| MOB1 | `DeskDesktop.tsx`, `DeskIcon.tsx`, `DeskReadme.tsx`, `DeskLegal.tsx`, `DeskGuestbook.tsx`, `DeskSettings.tsx`, `DeskMusic.tsx`, `DeskMovie.tsx`, `DeskTerminal.tsx`, `TermEditor.tsx`, their `en.ts` keys |
| MOB2 | `DeskSnake.tsx`, `DeskMinesweeper.tsx`, `DeskPaint.tsx`, new `DeskDpad.tsx`, new `src/lib/room/gestures.ts` (+test), their `en.ts` blocks |
| MOB3 | `DeskBlackjack.tsx`, `desk.blackjackApp` in `en.ts` |
| MOB4 | `DeskSolitaire.tsx`, `solitaire-engine.ts` (+test, a `bestMove` helper), `desk.solitaireApp` |
| MOB5 | `DeskPong.tsx`, new `src/lib/games/pong-view.ts` (+test), `desk.pongApp` |
| MOB6 | `DeskBreakout.tsx`, `breakout-engine.ts` (+test), `desk.breakoutApp` |
| MOB7 | `Room.tsx` (pan and hint only), `RoomObject.tsx`, `AnimatedSprite.tsx`, `ShelfBooks.tsx`, `RoomHud.tsx`, `DiscoveriesBadge.tsx`, `RoomReader.tsx`, new `src/lib/room/pan.ts` (+test), `room.*` keys in `en.ts` |
| MOB8 | `RoomSfxProvider.tsx`, `NowPlaying.tsx`, `RoomAudioProvider.tsx`, `playlist.ts`, new `scripts/generate-covers.mjs`, `assets/audio-covers/`, `public/audio/covers/` |

Waves: MOB0 alone; wave 1 = MOB1, MOB2, MOB4, MOB7; wave 2 = MOB3, MOB5, MOB6, MOB8; then MOB9-MOB11.

### MOB0: portrait contract, shell, code splitting, touch CSS (orchestrator)

**Interfaces produced (every builder relies on these):**
- `src/lib/room/desk-screen.ts`: `SCREEN_W = 536`, `SCREEN_H = 308`, `PORTRAIT_W = 320`, `PORTRAIT_MIN_H = 440`,
  `BEZEL = { side: 10, top: 12, chin: 26 }`, `MUSIC_BAR_H = 56`, `isPortraitPhone(vw, vh, mobile): boolean`,
  `portraitGeometry(availW, availH): { scale, w, h, left, top }`.
- `useStageScale()` returns `{ scale, mobile, fillScale, portrait }`.
- `ScreenStrip.tsx`: `interface DeskScreen { w: number; h: number; portrait: boolean }`, `DeskScreenContext`,
  `useDeskScreen(): DeskScreen`, `PORTRAIT_STRIP_H = 44`; in portrait `children` render in a second 44 px toolbar.
- `pixel-ui.tsx`: `ArcadeButton size="xl"` (38 px tall, 12 px font); `StripButton` is `xl` in portrait.
- `DeskArcade.tsx`: `ArcadeFrame` prop `portrait?: boolean`; `useFullscreen().supported` is false in portrait.
- `src/lib/room/media.ts`: `isMediaVolumeReadOnly(probe?: { volume: number }): boolean` (iOS ignores
  `HTMLMediaElement.volume`), used by Settings (MOB1) and NowPlaying (MOB8); node-tested with fake probes.

- [ ] **Step 1: failing tests for the geometry** in `src/lib/room/desk-screen.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPortraitPhone, portraitGeometry, PORTRAIT_MIN_H, PORTRAIT_W, BEZEL, MUSIC_BAR_H } from './desk-screen'

test('portrait phones get the portrait screen, everything else keeps the desk', () => {
  assert.equal(isPortraitPhone(390, 844, true), true)
  assert.equal(isPortraitPhone(360, 800, true), true)
  assert.equal(isPortraitPhone(430, 932, true), true)
  assert.equal(isPortraitPhone(844, 390, true), false)
  assert.equal(isPortraitPhone(768, 1024, true), false)
  assert.equal(isPortraitPhone(390, 844, false), false)
})

test('a 390x700 phone fills the width', () => {
  const g = portraitGeometry(390, 700)
  assert.equal(g.w, PORTRAIT_W)
  assert.ok(Math.abs(g.scale - 370 / 320) < 1e-9)
  assert.equal(g.h, Math.floor((700 - BEZEL.top - BEZEL.chin - MUSIC_BAR_H) / g.scale))
  assert.equal(g.left, BEZEL.side)
})

test('a short phone clamps to the minimum height and centres', () => {
  const g = portraitGeometry(375, 548)
  assert.equal(g.h, PORTRAIT_MIN_H)
  assert.ok(g.w * g.scale <= 375 - 2 * BEZEL.side)
  assert.ok(g.left > BEZEL.side)
})

test('the screen always fits its box', () => {
  for (let w = 300; w <= 480; w += 7) {
    for (let h = 480; h <= 1000; h += 13) {
      const g = portraitGeometry(w, h)
      assert.ok(g.h >= PORTRAIT_MIN_H)
      assert.ok(g.w * g.scale <= w - 2 * BEZEL.side + 1e-6)
      assert.ok(g.h * g.scale <= h - BEZEL.top - BEZEL.chin - MUSIC_BAR_H + 1e-6)
    }
  }
})
```

- [ ] **Step 2:** `npx tsx --test src/lib/room/desk-screen.test.ts`; expect failure (module missing).
- [ ] **Step 3: implement `desk-screen.ts`:**

```ts
export const SCREEN_W = 536
export const SCREEN_H = 308
export const PORTRAIT_W = 320
export const PORTRAIT_MIN_H = 440
/** Portrait shell chrome in CSS px. */
export const BEZEL = { side: 10, top: 12, chin: 26 } as const
export const MUSIC_BAR_H = 56

/** A portrait viewport where the landscape screen would render below 0.9x. */
export function isPortraitPhone(vw: number, vh: number, mobile: boolean): boolean {
  if (!mobile || vh <= vw) return false
  return Math.min((vw - 12) / SCREEN_W, (vh - 12) / SCREEN_H) < 0.9
}

export interface PortraitGeometry { scale: number; w: number; h: number; left: number; top: number }

/** The 320-wide logical screen inside the bezel, above the music bar, in a box with safe areas removed. */
export function portraitGeometry(availW: number, availH: number): PortraitGeometry {
  const maxW = Math.max(1, availW - 2 * BEZEL.side)
  const maxH = Math.max(1, availH - BEZEL.top - BEZEL.chin - MUSIC_BAR_H)
  let scale = maxW / PORTRAIT_W
  let h = Math.floor(maxH / scale)
  if (h < PORTRAIT_MIN_H) {
    scale = Math.min(scale, maxH / PORTRAIT_MIN_H)
    h = PORTRAIT_MIN_H
  }
  return { scale, w: PORTRAIT_W, h, left: Math.round((availW - PORTRAIT_W * scale) / 2), top: BEZEL.top }
}
```

- [ ] **Step 4:** tests pass; add `"test:room": "tsx --test \"src/lib/room/*.test.ts\""` to `package.json`.
- [ ] **Step 5: the contract.** `useStageScale` adds `portrait` (recomputed on every resize);
  `DeskScreenContext`/`useDeskScreen`/portrait strip in `ScreenStrip.tsx`; `xl` in `pixel-ui.tsx`; `ArcadeFrame`
  `portrait` prop with the compat scale `320 / 536`, `select-none` and no touch callout; `useFullscreen` reports
  unsupported in portrait and leaves full screen if the phone turns to portrait.
- [ ] **Step 6: the shell.** `DeskView`: root gets safe-area padding in portrait; a stable inner wrapper measured
  by a `ResizeObserver` feeds `portraitGeometry`; the stage is untransformed in portrait; desk art, lamp,
  speakers, notes, mouse and the "click again" bubble render only on the desk (one conditional slot);
  `PortraitBezel` renders only in portrait (one slot); the screen element keeps its place and switches between
  the stage rect and `left/top/w/h + scale(s)`; the music bar renders `NowPlaying embedded` in portrait (new
  `nowPlayingLabels` prop, Room skips its fixed player then); desk drag-pan, desk clicks and the landscape
  mobile layout are off in portrait. `DeskDesktop` gets `screenW/screenH` from the context.
- [ ] **Step 7: code splitting.** Every app but README and the desktop, plus `RoomReader` in Room, via
  `next/dynamic` (`ssr: false`, a pixel "Loading" state); idle prefetch of all app chunks unless Save-Data or a
  2g connection; `AppBoundary` error boundary around the screen content shows a pixel message with a reload
  button if a chunk fails.
- [ ] **Step 8: touch CSS** in `globals.css`: `overscroll-behavior: none` on html and body; no tap highlight in
  `.room-cursor`; `touch-action: manipulation` on its buttons and links; on `(pointer: coarse)` text inputs and
  textareas in `.room-cursor` get a 16 px font size.
- [ ] **Step 9: verify.** `npm run test:room`, `npm run type-check`, `npm run lint`, `npm run build` (First Load
  JS for `/` against the baseline), browser at 390x844 (bezel, README readable, compat games work), 844x390 and
  1408x768 (screenshots identical to `master`), rotate mid-Snake keeps state.
- [ ] **Step 10: commit** "Add the portrait desk shell and mobile contract".

### MOB1: desktop grid, text apps and terminal (deepcode)
Portrait layouts for the desktop grid (4 columns, 40-48 px icons, 10-11 px labels; files row and screensaver from
the context), README (12-13 px body, generous padding), Legal (full-width tabs, 12 px text), Guestbook (stacked
form, inputs 16 px on touch in both modes without breaking the landscape layout, focused input scrolled into view,
list below), Settings (full-width rows, big toggles and sliders, music slider hidden when media volume is
read-only), Music (44 px rows, 32 px covers), Movie (video at the full width, controls under it), Terminal and
TermEditor (character grid reflows to the portrait width; the visible input stays 16 px computed on touch and
matches the grid visually through a scale; no extra keys). Desktop layouts unchanged. The read-only volume check
is MOB0's `isMediaVolumeReadOnly()`. Acceptance: every screen at 320 x 440 and 320 x 640 with nothing clipped or
overflowing sideways, and the landscape desk unchanged.

### MOB2: Snake, Minesweeper, Paint, the D-pad (deepcode)
`src/lib/room/gestures.ts`: `swipeDirection(dx, dy, minDist = 24): 'up' | 'down' | 'left' | 'right' | null`
(dominant axis, null under the threshold) with node tests. `DeskDpad.tsx`: a pixel D-pad (four 44-56 px arrow
buttons in a cross, pointer down fires once and repeats never; `aria-label`s), reused by Snake only. Snake: portrait
board at 20 px cells (280 px) under a score row, D-pad below, swipes on the board steer, Pause and New game in the
toolbar; on a touch device in landscape the D-pad sits right of the board. Minesweeper: portrait cells 32 px, a
Reveal/Flag toggle (pressed state, keyboard reachable) used on tap; long-press still flags. Paint: canvas at 3 px
per pixel (321 wide, scaled to fit), tools as `xl` buttons, a 5x2 palette of 28 px swatches and a 38 px custom
colour button. All three opt into `ArcadeFrame portrait`.

### MOB3: Blackjack (deepcode)
Portrait table: dealer hand and shoe at the top, messages in the middle, player hands below (splits stack
vertically or overlap more, never off-table), chips and stake above an action row of `xl` buttons (Hit, Stand,
Double, Split, Deal); the 6-page tutorial dialog fits 320 x 440. Landscape unchanged. Opts into `ArcadeFrame portrait`.

### MOB4: Solitaire (deepcode)
`bestMove(state, from: Loc): Loc | null` in `solitaire-engine.ts` (foundation first, then a tableau column that
accepts it, lowest index; null when nothing is legal) with node tests; a tap (no drag) moves the card there, in
both orientations. Portrait layout: stock, waste, gap, four foundations over seven columns, cards at a scale that
fits seven columns in 320 px with at least 3 px gaps, fan steps sized to `h`. Drag still works. Opts into
`ArcadeFrame portrait`.

### MOB5: Pong (deepcode)
`src/lib/games/pong-view.ts`: pure `toView(x, y, portrait)` and `fromViewPaddle(clientAxis, portrait)` maps between
the engine's 536x280 court and the portrait view (x and y transposed: the engine's left paddle is the bottom one)
with node tests. Portrait: the court drawn vertical at the largest fit, menus and score laid out for portrait;
pointer events everywhere (`touch-action: none`): in one-player mode a drag anywhere moves your paddle; in
two-player mode each half of the court drives its own paddle (multi-touch). Landscape gains pointer (touch) drag.
Opts into `ArcadeFrame portrait`.

### MOB6: Breakout (deepcode)
Engine: court geometry (`courtW`, `courtH`, `brickW`, `gridX`, speeds scaled by court height) moves from module
constants into state set at `createGame(options)`, defaulting to today's landscape values so every existing test
passes unchanged; a portrait preset (about 300 x 440 with 14 columns of narrower bricks) with new tests (bricks fit
the court, a ball never leaves it, the same level strings parse). View: portrait canvas at the largest fit, HUD
above, drag anywhere to move the paddle, a game keeps its court across rotation until the next game. Opts into
`ArcadeFrame portrait`.

### MOB7: the room on phones (deepcode)
`src/lib/room/pan.ts`: pure momentum (`step(velocity, dt)` decay, release velocity from recent samples, clamp) with
node tests. Room: initial pan centred on the monitor on phones, momentum after a drag, edge chevrons until the
first drag, touch hint copy clear of the music bar. `RoomObject`/`AnimatedSprite`/`ShelfBooks`: hover state only
for `pointerType === 'mouse'`; on touch a tap plays the highlight, shows the tooltip for about 1.6 s and acts.
`RoomReader`: `dvh`, one page on phones, swipe and tap zones to turn pages, 44 px controls. `DiscoveriesBadge`:
44 px target, popup fits 320 px. Desktop unchanged.

### MOB8: audio and covers (deepcode)
`RoomSfxProvider` plays sound effects through Web Audio (fetch and decode each file once, a buffer source per play
through a gain node, context resumed on the first gesture, falls back silently), same `useSfx()` API and prefs.
`NowPlaying`: the volume slider hides where media volume is read-only (iOS); the cover renders after mount so the
server HTML does not preload a cover for a track that will not play. Covers: originals move to
`assets/audio-covers/`; `scripts/generate-covers.mjs` (`npm run covers`, ffmpeg) writes 128x128 JPEG thumbnails
(quality about 85) into `public/audio/covers/` with the same names.

### MOB9: integration and the viewport matrix (orchestrator)
Merge each builder branch after its own checks; run every suite, type-check, lint and a production build; walk
the matrix (390x844, 360x800, 430x932, 375x667 and 375x548 portrait with touch; 844x390; 768x1024; 1024x768;
1408x768 and 1920x1080 compared with `master`), every app at h 440 and 640, plus the Review Focus checks.

### MOB10: reviews (orchestrator plus deepcode)
A read-only deepcode second-opinion review of `feat/mobile` against this plan and a Claude review; verify every
finding before fixing; fix the real ones.

### MOB11: docs and handover (orchestrator)
CLAUDE.md: v22 entry and a "Phones" section with the portrait contract for future apps; the build log below; final
verification; ask the owner before merging into `master` (a push deploys).

### Build log
- 28 September: refining questions answered (portrait-native, monitor bezel, terminal desktop-only, music
  untouched); design and plan written; baseline build started for the JS comparison.
