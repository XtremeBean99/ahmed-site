# The room and desk in depth

Detail moved out of CLAUDE.md on 13 October 2026 (verbatim, with stale notes fixed only where marked). CLAUDE.md keeps the rules; this file keeps the per-app and per-sprite detail.

## Desk view (`DeskView.tsx`)
Close-up art (`desk-closeup.png` and `desk-closeup-lamp-off.png`, crossfaded+flickered via
`lampOn`/`lampFlicker` props passed from Room) with a clickable lamp toggle at (8,88 160×480)
Screen modes: `desktop | paint | minesweeper | snake | blackjack | solitaire | pong | breakout | chess | mahjong |
readme | music | legal | guestbook | settings | terminal | movie | typing | highscores | request`. Desktop icons:
LinkedIn (external), GitHub (external), Settings, Music, Paint, Minesweeper, Snake, Blackjack, Solitaire, Pong,
Breakout, Chess, Mahjong, README, Guestbook, Request, Movie, Legal, Scores, Typing (20: a 7-column grid in landscape,
three rows so the Terminal's `~/Desktop` file row still fits under it; 4 columns and five rows in portrait (full), where the icon box is 48 px and the row gap 4 px
so the fifth row fits at screen heights down to about 440). (Links/webring was removed
in v19; `terminal` stays konami-only and has no icon.)
**Shelf and iPod in the desk view (v23).** The close-up only shows the shelf's underside (rows 0..60), so
`desk-shelf-top.png` / `-lamp-off.png` (1408x270, drawn by `scripts/draw-desk-shelf.mjs` from the close-up's own
colours: side boards, back wall, a top board copied from the bottom one, the wall and lamp light above) sit at
stage y -270..0. Everything on the stage is inside a camera div; looking up translates it +270 px (0.7 s; the stage
clips with `overflow: hidden`). The items are their own art, not the room's: `scripts/draw-desk-shelf-items.mjs`
draws each one straight on and from below (fronts only, a sliver of side face toward the eye, 1 art px = 2 stage px
with 1 px black outlines like the close-up), one sprite each (books separate) with the room's rest + two-step
highlight frames (`desk-shelf-<id>-1..3.png`), and writes boxes and hit masks to `desk-shelf-sprites.ts`
(`DESK_SHELF_ITEMS` in `desk-shelf.ts`). `DeskShelf.tsx` renders them as `AnimatedSprite`s, then repaints the lip
(close-up rows 24..61) over their feet, so at rest only the bottoms show. At rest the items are `inert` and the strip is one "look up" button; ▲ Shelf
(on the wall right of the shelf), the wheel over the desk art, or the strip look up; ▼ Desk, the wheel or Escape (first
rung of the ladder) look down. Clicking a game, the VHS or Typing's Highscores button opens the app and looks down;
books open the e-reader (Room now renders `RoomReader` in the desk branch too); Catan opens /catan. Items dim with the
lamp. The iPod is `RoomIpod` at 2x on the desk right of the pad (`DESK_IPOD`). `RoomObject`'s button now fills its
box (`w-full h-full`), which the 2x sprites need; room sprites are unchanged since their box is the image.
`ShelfBooks` lets only the spines take the pointer (the box overlapped the Catan boxes' hotspot).
`typing` (`DeskTyping.tsx`, engine `src/lib/games/typing-engine.ts`, tests in `typing-engine.test.ts`): 15/30/60 s
tests over the shuffled `phrases.ts`; the clock starts on the first character; a transparent input over the text takes
the keys (phone keyboards and IME work); WPM counts correct characters, accuracy every keystroke; best WPM in
`BEST_KEYS.typing`. `highscores` (`DeskHighscores.tsx`): your best per game from games storage beside
`GET /api/highscores`' boards; posting sends your stored best under a name kept in `hiscore-name`. `request`
(`DeskRequest.tsx`): name and contact optional, message 5..1000, `POST /api/feature-request` (3/hr per IP).
`terminal` (`DeskTerminal.tsx` + `TermEditor.tsx`, engine in `src/lib/terminal/`): a client-only Linux
shell. `shell/` is an async bash interpreter (quoting, expansions, arrays, arithmetic, control flow,
functions, pipes, redirections, heredocs, aliases, `~/.bashrc`; an 8 s busy-time budget and Ctrl+C abort
stop runaway loops). `commands/*.ts` hold ~200 commands (coreutils, grep/sed/awk, jq, bc, tar, cowsay...)
merged in `commands/index.ts`, which also owns `help`/`man`. `editors/nano.ts` and `editors/vim*.ts` are
pure state machines rendered as a char grid; `TermEditor` feeds keys through a hidden textarea (so IME and
phone keyboards work) and swallows Escape so vim never closes the desk. Files live in a `VFS` saved to
`room-terminal-fs-v1` (1.5 MB cap), history in `room-terminal-history-v1`. Files in `~/Desktop` show as
icons on the pixel desktop (`DeskDesktop` `files`), clicking one opens it in nano; `download FILE` saves
to the visitor's real machine. Tests: `npm run test:terminal` (518). Design log: `docs/archive/todo-2026.md` (TRM).
`paint` (`DeskPaint.tsx`: 107×50 pixel canvas, 10-colour palette, pencil/eraser/fill tools,
persistent to `room-paint-v1`, PNG download), `minesweeper` (`DeskMinesweeper.tsx`: 9×9/10
mines, pure engine in `src/lib/games/minesweeper-engine.ts`, first-click safety,
right-click/long-press/F-key flagging, roving-tabindex keyboard play, best-time
localStorage), `snake` (`DeskSnake.tsx`: square 14×14 board at 16 px cells — the board must keep
`box-sizing: content-box`, since the global border-box rule in `globals.css` would shrink its
padding box by the border and knock the last row and column out of step with the grid; pure engine in
`src/lib/games/snake-engine.ts`, walls kill, arrows/WASD read from the **window** so a desk
click cannot break the controls, Space pauses, Enter restarts, auto-pause on tab hide,
best score in games storage; on touch screens a new game waits for the first swipe, D-pad press, board tap or
Start, while the desk with a mouse starts at once), `chess` (`DeskChess.tsx` + the pure engine in `src/lib/games/chess-engine.ts`: legal-move generation,
SAN, FEN/PGN, draw rules, and a time-bounded alpha-beta `bestMove` at four levels, Beginner to Expert; the app
plays the CPU as White, Black or random, or two players on one screen with optional auto-flip. The board is
DOM squares in a `role="grid"` with pieces as run-length SVG paths built from 10x10 pixel masks (outline grown
at build time, so any size stays crisp); click-to-move, drag-and-drop on pointer events, a roving keyboard
cursor on the focused board (arrows, Enter/Space; Escape closes the innermost layer first, in the capture phase,
before DeskView's app-to-desktop ladder sees it), promotion picker (also Q/R/B/N), last-move/check/selection
tints, captured pieces with material lead, SAN move list, Undo (takes back the CPU reply too; it replays the
history from the start, so it survives a reload), Flip, Hint (`bestMove` at level 3), Resign (two clicks) and
Copy PGN. The CPU thinks inside a 250 ms `setTimeout` guarded by a game-id ref, so New/Undo/unmount cancel it.
The game, settings and orientation save to `chess-save`, the win/loss/draw record against the CPU to
`chess-stats` (both in games storage); a finished saved game reopens for review without re-counting),
`mahjong` (`DeskMahjong.tsx` shell + `mahjong/`: `tile-art.tsx`, `Solitaire.tsx`, `FourPlayer.tsx`,
`mahjong-store.ts`, `labels.ts`, `chrome.ts`; pure engines `mahjong-tiles.ts`, `mahjong-solitaire.ts`,
`mahjong-engine.ts` + `mahjong-scoring.ts` + `mahjong-bot.ts`, tests via `npm run test:mahjong`). A mode picker
(Solitaire layout Turtle/Pyramid/Fortress and a dim-blocked-tiles setting; 4-Player bots Easy/Normal/Hard, minimum
faan 0/1/3, East round or full game, bot speed, auto-pass chow offers) plus Resume for the saved game. Tiles are
drawn in code: DOM boxes with an ivory face, a green side (box-shadow depth) and SVG faces on a 20x28 grid (dots,
bamboo sticks and a bird, characters with numeral + 萬, winds, dragons with a blue-frame white dragon, flowers and
seasons), simplified below 17 px wide; CJK glyphs come from the visitor's system fonts. Solitaire scales the layout
to fit (integer unit sizes, layers offset up-left), only free tiles respond, a hovered or selected tile is magnified
in the side panel (HUD row in portrait), Hint flashes a pair, Undo, Shuffle (offered when stuck), a timer and best
time per layout; keys H, U or Ctrl+Z, S, N. 4-Player is you (seat 0) against three bots under Hong Kong rules: the
engine is stepped one action at a time on a 70-560 ms `setTimeout` guarded by a game-id ref (New/unmount cancel it);
click a tile to select and again to discard (or the Discard button), claim prompts (Chow with each option shown,
Pung, Kong, Win, Pass; Escape or Space passes), tsumo and kong buttons, a "Ready, waiting on" row from
`waitingTiles`, four rivers with the last discard ringed, a log, a hand-over panel (winner, tiles, faan breakdown,
payments) and a match summary. Keys: arrows pick a tile, Enter discards, P/C/K/W/Space for claims, Escape closes the
hand-over panel or clears the selection before DeskView's ladder. Portrait stacks the opponents on top, the rivers
2x2, and the hand in two rows of seven with 38 px action buttons. Storage (games storage): `mahjong-save` (the game
in progress and its mode, validated by each engine's `validateSave`), `mahjong-prefs` (settings last used),
`mahjong-stats` (solitaire best time and wins per layout; 4-player matches and hands won, best faan). Before each
fresh 4-player hand `mahjong/AutoTable.tsx` plays the automatic table as pixel art: a 132x132 canvas scaled up
`pixelated`, every sprite drawn in code on the art grid (tiles with a back and an ivory near edge, 9x9 dice, 5x7
pixel faces on your rack) and the clock stepped at 20 fps so things hop pixel to pixel (tiles tumble into the
centre hatch as its lid turns, pinwheel walls pop up two high, dice, the deal off the wall at the break in blocks
of four to the racks; the overlay fades out in four hard steps; skippable with a click, Enter, Space or Escape;
off under reduced motion or the `tableAnim` pref); bots wait for it. Hint (H, or the strip button) in 4-Player
asks `hintFor` in `mahjong-bot.ts` (the hard bot's move plus the shanten after a suggested discard): the tile
glows, the matching claim/Win button shows pressed, and a line says why. Practice (menu button beside Start) is a
coached hand from `src/lib/games/mahjong-tutorial.ts`: a stacked deal where you discard a lone wind, pung, chow
from your left, get ready and win by self-draw; the bots follow a script and pass every claim, `coachFor` reads
the step from the state, only the coach's move is accepted (a nudge otherwise), and nothing is saved or recorded. Every `TileView` inside
`TileTipLayer` (`mahjong/tile-tip.tsx`, context in `tip-context.ts`) gets a mouse-hover tooltip from
`tile-info.ts`: the Chinese, its pinyin, the meaning and how the tile plays (copy in `mahjongApp.tileInfo`);
`tip={false}` opts a tile out. `mahjong/Tutorial.tsx` holds How to play for each mode (tiles, a tile guide, then
that mode's rules; `mahjong-solitaire-tutorial-seen`, `mahjong-four-tutorial-seen`),
`readme` (`DeskReadme.tsx`: renders `site-text.txt`), `music`
(`DeskMusic.tsx`: playlist picker), `legal` (`DeskLegal.tsx`: privacy/terms tabs, scrollable
legal doc). The `browser` mode was removed (Spec 1, July 2026). Escape ladder app→desktop→room.
Speakers (left 190,265 175×300; right 1005,270 215×300) are mute-toggle buttons with
press-dip and muted glyph. Music notes emit from the driver holes (left: 284,349 r34 /
284,478 r50; right: 1118,352 r38 / 1115,472 r52) at a constant 1100 ms rate, 2000 ms
float, pooled `<img>`s + CSS keyframes.
The desk mouse (110×80 sprite) follows the pointer proportionally within x 975–1140,
y 572–635 via rAF + lerp writing transforms directly (never React state per pointer event);
rest point (1007,608); static on touch/reduced-motion. Idle screensaver after 15 s.
Mouse jitter triggers on any click outside the screen area.

## Audio (`RoomAudioProvider` + `playlist.ts` + `NowPlaying` + `id3.ts`)
One context provider mounted above both views owning a single `Audio` element.
**It must ALWAYS provide context** — gating it behind reduced motion crashed every
reduced-motion visitor once (`useRoomAudio()` throws outside the provider). Reduced motion
never disables sound, only animation. Track index lives in a ref (URL string-matching against
`audio.src` broke `ended` advancement once). Autoplay is attempted only after a user
activation (v28: before one, a refused `play()` still downloaded about 1 MB), and the element gets its `src` only
right before the first `play()`. Volume defaults to 0.3, adjustable via a NowPlaying range slider, persisted as `volume` in `room-save-v1`. Track advance (skip and `ended`) picks randomly, never repeating the current track. `NowPlaying` (bottom-left, both views):
36×36 cover — external cover file first, then embedded ID3 APIC frame via `id3.ts`, then
cassette-SVG placeholder. Title 12px, artist 10px, play/pause/skip 18px icons. All labels
from dictionaries. `id3.ts` is a zero-dependency ID3v2 parser that fetches the first 256 KB
of an MP3 and extracts APIC (attached picture) frames; the shipped `.m4a` tracks have none, so every track needs
a cover file. NowPlaying renders the cover only after mount (the
server render would otherwise preload track 0's cover) and hides its volume slider where media volume is
read-only (iOS). Covers are 128x128 thumbnails in `public/audio/covers/` generated by `npm run covers` (ffmpeg)
from the originals in `assets/audio-covers/`; add new covers there and rerun. **Sound effects** (`RoomSfxProvider`)
are fetched once, decoded once and played through Web Audio (buffer source plus gain) on the shared
AudioContext that `tone()` also uses; it is unlocked on the first real user activation (a touch `pointerdown` is
not one: it listens to pointerup, touchend, click and keydown until the context runs).

## Room-view objects (`objects.ts` registry + `AnimatedSprite`)
monitor (235,257 402×350, 4 frames: rest + 3-frame hover highlight, play-once-hold,
with an 18-frame Win98 boot-screen overlay on the glass (270,282 214×171) that plays
simultaneously and also holds its last frame → zoom to desk; zoom origin stays at
stage (360,331) = rect + (125,74)) · poster (997,78 134×247, 5 frames, play-once-hold,
click toast) · bonsai (1241,291 99×131, 5 growth stages × 6 frames, loop from frame 3, `tooltipAlign="right"` because the
centred bubble overflowed the right edge) · lamp (60,300 110×220, hover tooltip, toggles lamp-off art
crossfade + flicker, persisted) · coffee (160,475 83×83, 6 frames: rest + 5-frame hover
highlight, play-once-hold) with three staggered CSS steam wisps (`steam-rise` keyframes,
per-wisp `--sway`/`--dur`, negative delays, rendered behind the mug) ·
side table (641,409 232×210, clickable, 2 frames: drawer closed/open, click toggles with tooltip, −2px hover lift, dims with the lamp, persisted in `sideTableOpen` pref) ·
digital clock (658,386 71×55, single frame, no hover lift; SideTableClock renders live user
time in LED green #35e65c on the blank face — digit plane (679,409) 43×22, skewY(−11°),
1 Hz colon blink gated by reduced motion, updates every 10 s; click toggles 12/24 h via
`clock24h` pref) · shelf games (`SHELF_GAMES` in `objects.ts`, built from the generated
`shelf-games.ts`: eight 3-frame sprites right of the VHS, play-once-hold: a chess set (board leaning
on the wall, chessmen in front), mahjong wall and tiles, card box, A+K cards with chips, two
floppies, candybar phone, Breakout and Pong cartridges. They overlap, so each passes
`hitPath` to AnimatedSprite: the box lets the pointer through and only a clip-path pixel mask takes
it, and the later sprite in the list is the one in front; a click zooms to the desk and opens that app through
`openDeskApp` → `pendingApp`/`initialApp`, like the VHS, and DeskView's open event counts the
discovery) · bedside book (`BEDSIDE_BOOK`, 739,533 46×55, the book in the side table's cubby:
opens the Guestbook the same way; dims with the lamp via AnimatedSprite `dimmed`; not rendered
while the drawer is open, since the drawer covers it).
All AnimatedSprite
objects (poster, bonsai, coffee) and the Monitor share a −2px hover lift (`motion.img`/
`motion.div` with `animate={{ y: -2 }}`, `DURATION.fast`). Desktop speakers
(`RoomSpeakers.tsx`): art layer (146,292 435×218) crossfades/flickers with the lamp;
cabinets (left 148,355 108×154; right 490,290 91×141) are mute-toggle buttons with hover tooltips, rendered
AFTER the monitor so they win its overlapping anchor rect; notes emit from driver holes
(left 215,408 r15 / 215,463 r25; right 546,345 r14 / 546,397 r24). Adding an object: entry in
`ROOM_OBJECTS` → sprites in `public/room/` → both dictionaries → render in `Room.tsx`.

## Sprite pipeline and style guide (former STYLE.md)
Source art in `assets/pixel-art/` (repo-internal, not deployed); web sprites in `public/room/`
as raw PNG served via `<img>` with `image-rendering: pixelated` — **never `next/image`**
(resampling destroys pixel art). Multi-frame sprites are cropped to a **shared union bbox
+2 px pad** across all frames so playback never jitters (`scripts/extract-*.mjs`).
Source art is organised by category under `assets/pixel-art/`:
- `background/` — full-canvas room backgrounds + bedroom-gen-original
- `bonsai/` — the full-grown tree's frames (`tree1..5.png`); `scripts/draw-bonsai.mjs` builds every growth
  stage from them (stages 1-3 drawn in code on the same pot, 5 adds blossoms) plus the hover highlight frames
- `xtreme-bean-animation/` — the splash's 28 keyframes; `scripts/extract-xtreme.mjs` adds in-betweens and packs
  `public/room/xtreme-sheet.png`
- `close-up-desk/` — desk close-up art + mouse-only-closeup
- `coffee/` — coffee mug + steam source frames
- `music-sfx/` — music-note sprite art
- `poster/` — kitagawa poster frames (`kitagawa-1..5.png`) + `hypergamy.png` (click-swap art)
- `shelf/` — catan boxes, `books1..3.png` (three book spines) and `vhs1..3.png`, each a rest
  frame plus two highlight frames; cropped by `scripts/extract-shelf.mjs`. The eight desk-game
  objects (`chess`, `mahjong`, `solitaire`, `blackjack`, `minesweeper`, `snake`, `pong`,
  `breakout`, each `<id>.png`/`<id>2.png`/`<id>3.png`) are generated, not hand-drawn:
  `scripts/draw-shelf-games.mjs` places textured faces (ASCII colour maps) in the shelf's own 3D
  space (u along the shelf, v up, w depth 0 front lip..1 back wall) and projects them with the
  oblique projection measured off the background (front lip y 242 at x 300 rising 0.135 px/px,
  depth vector (-54,-16)), so boxes show their top and left side, boards and floppies lean on the
  back wall and the objects overlap at different depths. It outlines each part in black and grows
  the #f6da9c highlight 1 px then 2 px. `extract-shelf.mjs` crops them and writes
  `src/lib/room/shelf-games.ts` (generated: each box in render order plus a pixel hit mask). Edit
  the maps or placements there and rerun
  `node scripts/draw-shelf-games.mjs && node scripts/extract-shelf.mjs && npm run lighting`
- `room-view-monitor/` — monitor+keyboard+mouse base + highlight frames,
  `room-view-monitor/monitor-loading/` — Win98 boot-screen frames,
  room-speakers lamp-on/off art
Palette: warm dusk bedroom — wall #4a3e3a, wood #6b4d3a/#5a3d2a/#4a3020, floor #3a2820,
bezel #2a2220; lamp amber from the left, dusk-blue window light from the right; clean 1 px
outlines, no anti-aliasing. UI palette for bubbles/toasts: #3d2e1e fill, #5a4430 border,
#e8d5b0 text. Pixel font: `src/fonts/Minecraft.ttf` (fan recreation, free for personal use)
via `next/font/local` → `--font-pixel`, fallback `"Courier New", monospace`.
Lighting variants: `public/room/lighting/<state>/` generated from the `public/room/`
originals (dusk = originals); regenerate with `npm run lighting` after ANY sprite
re-extraction.

Extracted sprite ledger: poster-1..5 (997,78 134×247) ·
monitor-1..4 (235,257 402×350, rest + hover highlight) ·
monitor-loading-1..18 (270,282 214×171, boot screen on the glass) ·
room-speakers / room-speakers-lamp-off (146,292 435×218) ·
bonsai-<stage 1..5>-<frame 1..6> (1241,291 99×131) · desk-closeup (full canvas) ·
desk-closeup-lamp-off (full canvas) · background / background-lamp-off
(full canvas) · mouse (1007,608 110×80) · speaker-left/right (speaker rects) · note-1..3
(~16–21×22) · coffee-1..6 (160,475 83×83) · coffee-steam (187,460 25×45) ·
side-table-1..2 (641,409 232×210) · side-table-clock (658,386 71×55) · bedside-book-1..3
(739,533 46×55) — all extracted by scripts/extract-side-table.mjs from
assets/pixel-art/background/; the book is cut out of side-table-1 (hole filled with the cubby
colours) so it can lift · shelf-<game>-1..3 for the eight desk games (boxes generated into `src/lib/room/shelf-games.ts`).
Background (`background.png`, ~55 KB) loads `fetchpriority="high"` as the LCP element.

## Audio licences (former audio-licences.md)
Owner direction 6 July 2026: deployment treated as private/testing; commercial recordings ship
at the owner's informed risk; revisit before public promotion. The domain is publicly
reachable. (General information, not legal advice.) Tracks in `public/audio/` (`.m4a`, masters in `assets/audio/`):
cant-look-in-my-eyes ⚠ commercial ·
remember-summer-days ⚠ commercial. Cover: summer-days.jpg.
