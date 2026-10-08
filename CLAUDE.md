# CLAUDE.md — AI Agent Context for ahmedyhussain.com

The single consolidated context document for this project. Read this before touching any code.
It absorbs the former `docs/PLAN.md` (spec history), `docs/taskt.txt` (original room brief),
`docs/audio-licences.md`, `docs/suggestions.txt` (June audit), and `assets/pixel-art/STYLE.md`,
all of which have been retired. Last consolidated: 6 July 2026.

---

## What This Project Is

A production personal website for **Ahmed Hussain** \u2014 BComp/LLB(Hons) candidate at ANU, Canberra.
Domain: `ahmedyhussain.com`
Repo: `https://github.com/XtremeBean99/ahmed-site`
Vercel project: `ahmed-site` (ID: `prj_lF32Zp1qlFEKH7XzEW3yUdddQm61`)

The homepage `/` is the **digital bedroom**: an interactive, room-only pixel-art experience.
The conventional site pages (`/home`, `/games`, `/projects`, `/tutoring`, `/legal`) were
retired in Spec 1 (July 2026) and 301-redirect to `/`. Their source code is archived under
`_archive/` — not part of the build, recoverable via `git mv`.

## Current State (28 September 2026)

Latest: the room and desk are portrait-native and touch-first on phones (v22 below; the contract every desk app
follows is in "Phones" under the Room section). Before that: Pixel Catan v3 (v21) and one desk chrome (v20).


Pixel OS v1 desk launcher (Home/Paint/Minesweeper icons with bubble tooltips; Paint app
with persistent localStorage canvas `room-paint-v1` + PNG download; in-monitor Minesweeper
with pure engine in `src/lib/games/minesweeper-engine.ts` and best time via games storage),
Visitor-local lighting states (dawn/day/dusk/night, build-time graded variants via
`scripts/generate-lighting.mjs` + `npm run lighting`, `?light=` override, 1.5 s background
crossfade),
Side table + digital alarm clock on it (live user time in green LED digits skewY'd −11° onto
the face plane; click toggles 12/24 h, persisted as `clock24h`; deliberately no hover lift),
Monitor hover highlight (4-frame yellow outline + simultaneous 18-frame Win98 boot-screen
overlay, both play-once-hold), −2px hover lifts on all room objects (monitor, poster, bonsai,
coffee, side table), clickable room-view speakers with mute/unmute + music notes, clickable
lamp in desk close-up with lamp-off art crossfade, clickable side table with 2-frame drawer
open/close toggle (persisted to localStorage), desk close-up respects persisted lamp state.
Continuing: room scene with monitor/poster/bonsai/lamp/coffee/side-table hotspots, zoom
transition into a desk close-up, in-monitor browsing of the real site via same-origin iframe
(site content zoomed out 25% for readability), six-track music player with now-playing widget
(with embedded ID3 cover art extraction) and speaker mute, pointer-following desk mouse,
music notes from the speaker drivers, three-wisp coffee steam, lamp-off art crossfade with
flicker, warm lamp glow overlay, idle screensaver (15 s), "My room" CTA on /home linking
back to /, EN/FR throughout. No pending actions remain.

---

## Critical Constraints

### 1. Design must remain strictly monochrome (except the room page)
The design uses zinc-950 (`#09090b`) background, white text, zinc-800 borders. No colour accents.
No gradients except the subtle hero vignette. If you add new UI, match this palette exactly.
References: Vercel, Linear, Stripe aesthetic.
**Exception:** `/` (the room) uses a warm brown/mauve pixel-art palette. This exemption is
scoped to `/` and `/catan` (the pixel Catan game launched from the room's shelf). Do NOT add
colour to any `(site)` page.

### 2. All user input is hostile
Two API routes exist. `src/app/api/weather/route.ts` is read-only (Open-Meteo, fixed Canberra,
hourly-cached, fail-soft, no key, no secrets — added in Spec E). `src/app/api/guestbook/route.ts`
**accepts user input** (Spec F, v17): its `POST` runs CSRF (Origin/Referer must match the prod
domain), IP rate-limiting (`src/lib/ratelimit.ts`, 5/hr, Upstash + in-memory fallback), a honeypot
(`website` must be empty), Zod validation (`guestbookSchema` in `src/lib/validations.ts`, name ≤ 32,
message ≤ 280), and control-char/HTML/profanity stripping before storing. `DELETE` requires
`GUESTBOOK_ADMIN_KEY` sent as `Authorization: Bearer <key>` or `X-Admin-Key` — never as a query
param (query strings land in access logs) — rate-limited (30/hr per IP) BEFORE the auth check so
the key cannot be brute-forced, and compared in constant time over SHA-256 digests. The
`?health=1` probe returns `{ ok: false }` only; error text stays in the server log because an
Upstash client error can carry the REST URL and token. Never skip server-side validation; if another input route is added, follow
this same pattern (mirrors the archived `_archive/services/contact.ts`).

### 2b. Books and the film are static assets, not services
The shelf books are public-domain texts converted once from the PDFs in `assets/books/`
(gitignored, too large to commit) into `public/books/<id>.json` by
`scripts/extract-books.mjs`, which needs `npm i --no-save pdfjs-dist` — deliberately NOT a
site dependency. One JSON page per printed page, so the reader (`RoomReader`) turns pages
where the book does; prose reflows into paragraphs, verse keeps its lines. The book list and
each spine's hotspot live in `src/lib/room/books.ts`. The film is `public/video/shrek.mp4`
(~42 MB, committed), played by `DeskMovie` on the desk monitor; it is reachable from the
shelf VHS (which zooms to the desk via `initialApp`) and from the desktop Movie shortcut.

### 3. Persistence is localStorage-first; the one server store is the guestbook
Room preferences live in `localStorage`, client-side only:
`room-save-v1` = `{ audio, lampOn, visitCount, volume, clock24h, sideTableOpen, sfx, sfxVolume, calmMode }`;
plus `room-paint-v1` (Paint canvas), `room-discoveries-v1` (discoveries set) and
`room-reader-v1` (`{ size, pages: { <bookId>: pageIndex } }`, the e-reader's bookmarks), and
`catan-save-v2` (the in-progress Catan `GameState`, validated on load; older `catan-save-v1` saves migrate). The **only**
server-side store is the guestbook (Spec F, v17): an Upstash Redis sorted set `guestbook:entries`
(newest 500, scored by timestamp) behind `src/services/guestbook.ts`, storing **name + message +
timestamp only** — no email, no persisted IP (rate-limit keys expire after one hour). Any further
server persistence goes behind `src/services/` with env-var credentials (see `_archive/services/`).

### 4. Secrets via environment variables only
The guestbook (Spec F, v17) requires `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and
`GUESTBOOK_ADMIN_KEY` (for the `DELETE` escape hatch). Without the Upstash vars the guestbook
fails soft (GET returns `[]`, POST 500s) rather than crashing the build — `getRedis()` is lazy.
`RESEND_*`/`CONTACT_*` remain retired (contact form archived in Spec 1). Keep all credentials in
env vars only, never hardcoded. See `.env.example`.

### 5. The site is English-only
All French was removed in July 2026. Single source of truth: `src/lib/i18n/dictionaries/en.ts`.
The `Dictionary` type derives from `en.ts`. The i18n wrapper (`I18nProvider`, `getDictionary`)
remains for compatibility but always returns English.

### 6. Framing headers are now DENY / 'none'
The in-monitor browser was removed in Spec 1 (July 2026). `next.config.ts` now sends
`X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`. Third-party embedding is blocked.
Vercel serves case-sensitively; Windows dev machines do not. A track that plays locally but
404s deployed is a case mismatch between git and `playlist.ts` (the Saffron incident). Keep
`public/audio/` kebab-case lowercase; verify with `git ls-files public/audio`.

---

## Architecture in One Page

```
src/
├── app/
│   ├── (site)/            Route group — chrome for all content pages (URLs unchanged)
│   │   ├── layout.tsx     Site chrome: skip-link, CircuitBackdrop/Mesh, Header, main, Footer
│   │   ├── template.tsx   Per-route fade (client, reduced-motion safe)
│   │   ├── home/          The former homepage (Hero…Contact sections), now at /home
│   │   ├── games/         Hub + typing-test + breakout + ninja
│   │   ├── projects/      Hub + code + silicon + aglc4 + base-converter + ninja(redirect)
│   │   ├── tutoring/      Services, pricing, FAQ, enquiry form
│   │   └── legal/         Terms + Privacy
│   ├── layout.tsx         Root: fonts, metadata, I18nProvider only. No chrome.
│   ├── page.tsx           The room (server shell → <Room/>), chrome-free
│   └── api/               contact + ninja/leaderboard routes
│
├── components/
│   ├── room/              Room.tsx (state machine: room→zooming→desk), RoomStage,
│   │                      RoomObject (hotspot + tooltip), AnimatedSprite, Monitor,
│   │                      RoomSpeakers (art + mute/unmute + MusicNotes),
│   │                      DeskView (close-up + launcher/browser/paint/minesweeper),
│   │                      DeskDesktop, DeskIcon, DeskPaint, DeskMinesweeper,
│   │                      ScreenStrip, MusicNotes, SideTableClock,
│   │                      NowPlaying, RoomAudioProvider, RoomHud
│   ├── games/ layout/ projects/ sections/ ui/   (unchanged monochrome site components)
│
├── lib/
│   ├── room/              objects.ts (hotspot registry), playlist.ts (Track[]),
│   │                      storage.ts (localStorage prefs), useStageScale.ts
│   ├── aglc4/ convert/ games/ github/ i18n/ ninja/
│   ├── motion.ts redis.ts resend.ts ratelimit.ts utils.ts validations.ts
└── services/              contact.ts, leaderboard.ts
```

Default to Server Components; `'use client'` only for browser APIs, state, or Framer Motion.

---

## The Room (`/`) — Everything an Agent Must Know

### Stage and transforms (do NOT reintroduce the origin bug)
Fixed 1408×768 stage, fit-scaled with letterboxing. Two-element transform:
the **outer** wrapper centres and fit-scales about `center center`; the **inner** element
zooms about the monitor screen point *in stage coordinates*. Applying the fit scale on an
element whose transform-origin is the monitor point shifts the whole room off-centre — this
shipped once and was the v3 "site is off-centre" bug.

### View state machine (`Room.tsx`)
`room → zooming (800 ms, Escape-cancellable, 1.5 s safety) → desk`. Desk state is
`history.pushState('#desk')`; `/#desk` deep-links; popstate/Escape return. The room renders
inside its own monitor iframe (recursion guard removed — `/` is accessible from the desk browser).

### Desk view (`DeskView.tsx`)
Close-up art (`desk-closeup.png` and `desk-closeup-lamp-off.png`, crossfaded+flickered via
`lampOn`/`lampFlicker` props passed from Room) with a clickable lamp toggle at (8,88 160×480)
Screen modes: `desktop | paint | minesweeper | snake | blackjack | solitaire | pong | breakout | chess | mahjong |
readme | music | legal | guestbook | settings | terminal | movie`. Desktop icons: LinkedIn (external),
GitHub (external), Settings, Music, Paint, Minesweeper, Snake, Blackjack, Solitaire, Pong, Breakout, Chess,
Mahjong, README, Guestbook, Movie, Legal (17: a 6-column grid in landscape, three rows so the Terminal's `~/Desktop`
file row still fits under it; 4 columns and five rows in portrait, where the icon box is 48 px and the row gap 4 px
so the fifth row fits at screen heights down to about 440). (Links/webring was removed
in v19; `terminal` stays konami-only and has no icon.)
`terminal` (`DeskTerminal.tsx` + `TermEditor.tsx`, engine in `src/lib/terminal/`): a client-only Linux
shell. `shell/` is an async bash interpreter (quoting, expansions, arrays, arithmetic, control flow,
functions, pipes, redirections, heredocs, aliases, `~/.bashrc`; an 8 s busy-time budget and Ctrl+C abort
stop runaway loops). `commands/*.ts` hold ~200 commands (coreutils, grep/sed/awk, jq, bc, tar, cowsay...)
merged in `commands/index.ts`, which also owns `help`/`man`. `editors/nano.ts` and `editors/vim*.ts` are
pure state machines rendered as a char grid; `TermEditor` feeds keys through a hidden textarea (so IME and
phone keyboards work) and swallows Escape so vim never closes the desk. Files live in a `VFS` saved to
`room-terminal-fs-v1` (1.5 MB cap), history in `room-terminal-history-v1`. Files in `~/Desktop` show as
icons on the pixel desktop (`DeskDesktop` `files`), clicking one opens it in nano; `download FILE` saves
to the visitor's real machine. Tests: `npm run test:terminal` (518). Design log: `todo.md` (TRM).
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
`mahjong-stats` (solitaire best time and wins per layout; 4-player matches and hands won, best faan),
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

### Phones (portrait screen, touch) — the contract every desk app follows
- **Modes.** `isPortraitPhone(vw, vh, mobile)` (`src/lib/room/desk-screen.ts`): a mobile viewport (no fine pointer,
  or under 700 px) in portrait where the 536x308 screen would render below 0.9x. Those phones get a **portrait
  screen**: 320 logical px wide and `h` tall (440 to about 700), scaled as one unit by about 1.06-1.28x inside a
  pixel bezel sampled from the monitor art (`PortraitBezel`, 10/12/26 px sides/top/chin, green LED) with a 56 px
  music bar underneath (`NowPlaying embedded`; Room skips its fixed player then). Everything else (desktops,
  tablets, landscape phones) keeps the scaled desk; on mobile the desk fits the screen above the fixed player.
- **Context.** `useDeskScreen()` (from `ScreenStrip.tsx`) gives `{ w, h, portrait }`: `{536, 308, false}` on the
  desk. Lay out in logical px from it; never store layout-derived coordinates in state.
- **Rotation keeps state.** DeskView keeps one element tree (desk art and bezel are conditional siblings of the
  screen element), so a phone rotating mid-game only re-lays the app out. Keep your root (`ArcadeFrame` for games)
  the same in both layouts, branch inside it, and never `key` on `portrait`.
- **ArcadeFrame `portrait` prop.** Pass it once an app has a portrait layout; without it the app runs in compat
  mode (its 536x308 layout scaled to 320 wide, with the desk screen in its context). Full screen is unsupported in
  portrait. The frame is `select-none` with no touch callout.
- **Strip.** In portrait `ScreenStrip` is 44 px (clock, title, Desktop, ← Room) and any children move to a second
  44 px toolbar row (`PORTRAIT_STRIP_H`); `StripButton` becomes `xl`. `ArcadeButton size="xl"` is 38 px (about
  44 CSS px): the portrait tap target. Minimum text 12 px (labels 10).
- **Touch rules.** Pointer events, never mouse events; `touchAction: 'none'` on anything dragged or swiped; hover
  only for `pointerType === 'mouse'`; `useStageScale().mobile` for landscape touch affordances. Globals: no tap
  highlight, `touch-action: manipulation` on room buttons, no pull to refresh, 16 px text inputs on coarse
  pointers (iOS zooms below that; the stage transform does not count). Media volume is read-only on iOS
  (`isMediaVolumeReadOnly()`; the sliders hide there).
- **Loading.** Every desk app but README and the desktop is a `next/dynamic` chunk prefetched on idle (not on
  Save-Data or 2g), each wrapped in `AppBoundary` (a failed chunk shows Reload / Desktop instead of crashing).
  `/` First Load JS went from 345 kB to 177 kB.
- **Adding an app:** build the 536x308 layout, then a portrait layout from `useDeskScreen()` checked at h 440 and
  640, add it to the dynamic imports and `APP_CHUNKS` in DeskView, and pass `portrait` to `ArcadeFrame`.
- **Checking phones:** the browser pane has no fine pointer (it always runs the mobile paths) and freezes animation
  frames while hidden; a headless Edge driven over the DevTools protocol gives exact viewports, touch emulation
  and a real mouse (the scratch script used for v22 is described in `todo.md`).

### Audio (`RoomAudioProvider` + `playlist.ts` + `NowPlaying` + `id3.ts`)
One context provider mounted above both views owning a single `Audio` element.
**It must ALWAYS provide context** — gating it behind reduced motion crashed every
reduced-motion visitor once (`useRoomAudio()` throws outside the provider). Reduced motion
never disables sound, only animation. Track index lives in a ref (URL string-matching against
`audio.src` broke `ended` advancement once). Autoplay attempts on mount when the stored pref
allows, falling back to first-gesture. Volume defaults to 0.3, adjustable via a NowPlaying range slider, persisted as `volume` in `room-save-v1`. Track advance (skip and `ended`) picks randomly, never repeating the current track. `NowPlaying` (bottom-left, both views):
36×36 cover — external cover file first, then embedded ID3 APIC frame via `id3.ts`, then
cassette-SVG placeholder. Title 12px, artist 10px, play/pause/skip 18px icons. All labels
from dictionaries. `id3.ts` is a zero-dependency ID3v2 parser that fetches the first 256 KB
of an MP3 and extracts APIC (attached picture) frames. NowPlaying renders the cover only after mount (the
server render would otherwise preload track 0's cover) and hides its volume slider where media volume is
read-only (iOS). Covers are 128x128 thumbnails in `public/audio/covers/` generated by `npm run covers` (ffmpeg)
from the originals in `assets/audio-covers/`; add new covers there and rerun. **Sound effects** (`RoomSfxProvider`)
are fetched once, decoded once and played through Web Audio (buffer source plus gain) on the shared
AudioContext that `tone()` also uses; it is unlocked on the first real user activation (a touch `pointerdown` is
not one: it listens to pointerup, touchend, click and keydown until the context runs).

### Room-view objects (`objects.ts` registry + `AnimatedSprite`)
monitor (235,257 402×350, 4 frames: rest + 3-frame hover highlight, play-once-hold,
with an 18-frame Win98 boot-screen overlay on the glass (270,282 214×171) that plays
simultaneously and also holds its last frame → zoom to desk; zoom origin stays at
stage (360,331) = rect + (125,74)) · poster (997,78 134×247, 5 frames, play-once-hold,
click toast) · bonsai (1241,291 99×131, 5 frames, loop, `tooltipAlign="right"` because the
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

### Accessibility invariants
AnimatedSprite, Monitor, and RoomSpeakers map their frame srcs through the
`LightingProvider` context (via `useLighting()` + `lightingSrc()` from
`src/lib/room/lighting.tsx`). Emissive layers (boot screen, music notes, clock LED digits)
are never graded.

Every hotspot is a real `<a>`/`<button>` inside `<nav aria-label>`; visible focus-visible
rings (2 px warm outline, offset); tooltips on focus as well as hover; skip link first in tab
order targeting `/home`; decorative layers (`MusicNotes`, steam, pad mouse) are
`aria-hidden` + `pointer-events: none`; `prefers-reduced-motion` disables all decorative
animation but never functionality.

### Sprite pipeline and style guide (former STYLE.md)
Source art in `assets/pixel-art/` (repo-internal, not deployed); web sprites in `public/room/`
as raw PNG served via `<img>` with `image-rendering: pixelated` — **never `next/image`**
(resampling destroys pixel art). Multi-frame sprites are cropped to a **shared union bbox
+2 px pad** across all frames so playback never jitters (`scripts/extract-*.mjs`).
Source art is organised by category under `assets/pixel-art/`:
- `background/` — full-canvas room backgrounds + bedroom-gen-original
- `bonsai/` — bonsai tree frames (`tree1..5.png`)
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
bonsai-1..5 (1241,291 99×131) · desk-closeup (full canvas) ·
desk-closeup-lamp-off (full canvas) · background / background-lamp-off
(full canvas) · mouse (1007,608 110×80) · speaker-left/right (speaker rects) · note-1..3
(~16–21×22) · coffee-1..6 (160,475 83×83) · coffee-steam (187,460 25×45) ·
side-table-1..2 (641,409 232×210) · side-table-clock (658,386 71×55) · bedside-book-1..3
(739,533 46×55) — all extracted by scripts/extract-side-table.mjs from
assets/pixel-art/background/; the book is cut out of side-table-1 (hole filled with the cubby
colours) so it can lift · shelf-<game>-1..3 for the eight desk games (boxes generated into `src/lib/room/shelf-games.ts`).
Background (`background.png`, ~55 KB) loads `fetchpriority="high"` as the LCP element.

### Audio licences (former audio-licences.md)
Owner direction 6 July 2026: deployment treated as private/testing; commercial recordings ship
at the owner's informed risk; revisit before public promotion. The domain is publicly
reachable. (General information, not legal advice.) Tracks in `public/audio/`:
cant-look-in-my-eyes ⚠ commercial ·
remember-summer-days ⚠ commercial. Cover: summer-days.jpg.

### Session history (condensed from the retired PLAN.md specs)
- **v1** `b70857e`–`a109482`: `(site)` restructure, room v1 (monitor→/home, poster, bonsai).
- **v2** `5643ee2`–`e7a40e4`+: defect fixes, Minecraft font, desk view + shortcuts.
- **v3** `0127b8d` era: centring fix, audio provider + playlist, now-playing, speakers, pad
  mouse, lamp art. Notable bugs fixed: off-centre transform origin; dead toggle when audio
  pref false.
- **v4** `aa9db95`–`ca70b5b`: reduced-motion crash fix, in-monitor browsing, music notes,
  coffee mug + owner extras (clock, flicker, jitter, screensaver).
- **v5** `ea902e8`–`64101ee`: frame-headers fix (XFO DENY → SAMEORIGIN), constant-rate
  notes from driver holes, coffee highlight frames + 3-wisp steam, bonsai `tooltipAlign`,
  clock i18n, docs consolidation into this file, saffron case rename done.
- **Post-v5** `674c158`–`9820230`: "My room" CTA on /home hero, recursion guard removed
  (room renders inside its own iframe), body `overflow:hidden` removed (iframe scroll fix),
  ID3 embedded cover art extractor, iframe site content zoomed out 25%, expand opens new tab,
  visitor counter, window tint removed, animation speeds bumped, UI sizes increased.
- **v7** (7 July 2026): side table + digital clock (live user time, green LED digits on the
  isometric face plane, 12/24 h click toggle persisted, no hover pickup by design); hover
  tooltips added to lamp and speakers; updated background-lamp-off art.
- **v8** (7 July 2026): visitor-local lighting engine (build-time graded sprites for
  dawn/day/night, `npm run lighting` pipeline, `?light=` query override, 1.5 s background
  crossfade, runtime `LightingProvider` context, clock unfrozen to live visitor-local time,
  night brightness at 0.93 (1.5× original) so the lamp feels brighter at night).
- **v9** (7 July 2026): Pixel OS v1 launcher replacing the six site shortcuts with three
  icons (Home/Paint/Minesweeper); Paint app (`DeskPaint.tsx`) with 10-colour palette,
  tools (pencil/eraser/fill), persistent canvas (`room-paint-v1`), PNG download;
  Minesweeper app (`DeskMinesweeper.tsx`) with pure engine (`minesweeper-engine.ts`),
  first-click safety, flagging (right-click/long-press/F key), best-time storage;
  ScreenStrip and DeskDesktop extracted from DeskView; screen modes expanded to
  `desktop | browser | paint | minesweeper`; Escape ladder app → desktop → room.
- **v9b** (7 July 2026): removed ambient dust motes; bumped night lighting brightness to
  0.93 (1.5×); restored lamp glow overlay (warm radial gradient near the lamp).
- **v10** (10 July 2026): side table is now clickable with a 2-frame drawer open/close
  animation (side-table-1.png: closed, side-table-2.png: open); click toggles the drawer
  with a tooltip, persisted in `sideTableOpen` pref in `room-save-v1`; −2px hover lift like
  other room objects; extraction script updated for union-bbox multi-frame output
  (232×210, up from 173×215). No other room invariants changed.
- **v11 (Spec 1)** `10 July 2026`: Hover animation fix (AnimatedSprite frame preload); room-only
  architecture — browser removed, Legal app added (`DeskLegal.tsx`, privacy/terms tabs, EN+FR),
  all `(site)` routes 301 → `/`, code archived to `_archive/`, frame headers hardened to
  DENY/'none', ninja COOP/COEP block retired from vercel.json, privacy/terms text updated for
  the form-less site, retired constraint 6, dead env vars noted. Desktop icons: LinkedIn,
  GitHub, Music, Paint, Minesweeper, README, Legal. Screen modes: `desktop | paint |
  minesweeper | readme | music | legal`.
- **v12** `10 July 2026`: Removed all French language from the project (fr.ts deleted,
  i18n simplified to English-only, LanguageToggle removed). Removed global click SFX
  (pointerdown listener), clicks now play only on explicit SFX calls (monitor/pcStart).
  Added poster SFX to saitama poster. Removed all em dashes site-wide (replaced with
  commas or restructured sentences). Settings app added (Spec 7 / Plan A): SFX toggle,
  SFX/music volume sliders, clock toggle, calm mode. Calm mode restores OS reduced-motion
  when enabled. Desktop icons: LinkedIn, GitHub, Settings, Music, Paint, Minesweeper,
  README, Legal. Screen modes: `desktop | paint | minesweeper | readme | music | legal | settings`.
- **v13** `11 July 2026`: Plan B (discoverability): achievements/discoveries system
  with toasts, DiscoveriesBadge (found/locked popup), first-visit hint pulses,
  konami code terminal easter egg (DeskTerminal with green-on-dark CLI). All
  highlight/pickup animations now forced always (MotionProvider reducedMotion="never",
  calm mode no longer affects motion). Screen modes: `desktop | paint | minesweeper |
  readme | music | legal | settings | terminal`. Desktop icons unchanged (terminal
  is hidden, konami-only).
- **v14** `11 July 2026`: Plan C (mobile): `useStageScale` reports a mobile mode (fill-height),
  `RoomStage` accepts a pan translate, drag-to-pan on coarse-pointer/narrow viewports, larger
  tap targets, idle preload of desk art. **Two known follow-ups from the v12/v13 changes:**
  (a) the **global click SFX was removed** (v12) — `'click'` is registered in `RoomSfxProvider`
  but never played; re-add a `pointerdown → play('click')` listener if the always-click
  behaviour (an explicit earlier request) is still wanted; (b) **calm mode is currently a
  no-op** — `MotionProvider` is hardcoded `reducedMotion="never"` and `prefersReducedMotion()`
  returns false, yet `DeskSettings` still renders a Calm-mode toggle. Either restore the pref
  wiring (see the v12 Settings commit) or remove the dead control.
- **v15** `11 July 2026`: Spec E (life & atmosphere, part 1). Window atmosphere — `RoomWeather`
  (real Canberra precipitation via the new `/api/weather` route → CSS rain/snow clipped to the
  window glass, always visible) and `RoomNightSky` (emissive moon + twinkling stars, `night`
  state only). `WINDOW_GLASS` rect in `objects.ts`; both render before the bonsai; `'night'`
  discovery added. Also: animated sprites are hover/tap-only again (mount-autoplay removed) and
  the sprite preload now warms the current lighting state's frames. (Deferred, needs art:
  record player, cat.)
- **v16** `11 July 2026`: Resolved the two v14 follow-ups. **Calm-mode toggle removed** from
  Settings (it was inert; `MotionProvider` stays `reducedMotion="never"` so motion is always on
  with no opt-out). The `calmMode` pref remains in `storage.ts` as a harmless orphan (nothing
  reads/writes it). **Global click SFX: final decision off** — re-added then removed again
  (`f9e1dd6`→`cd3a463`); the click sound plays only on explicit interactions, not on every click.
- **v17 (Spec F)** `11 July 2026`: Personal-web features ported from the `./reference` neocities
  site. **Phase 1 (client-only):** custom pixel cursor scoped to `/` via `.room-cursor`
  (`globals.css`, pointer-devices only, `public/room/cursor/{pointer,grab}.png` from
  `scripts/generate-cursors.mjs`); "currently" status sticky note on the desktop
  (`room.statusNote`, `DeskDesktop.tsx`, fires the `status` discovery on mount); `changelog`
  terminal command (`src/lib/room/changelog.ts`, `DeskTerminal.tsx`); Links/webring app
  (`DeskLinks.tsx` + `src/lib/room/links.ts`, 88×31 buttons from `public/buttons/`).
  **Phase 2 (server guestbook):** Upstash Redis restored from `_archive` (`src/lib/redis.ts`,
  `src/lib/ratelimit.ts`, `src/services/guestbook.ts`, `src/lib/validations.ts`); write API
  `src/app/api/guestbook/route.ts` (GET latest 50 / POST instant-publish with CSRF + rate-limit +
  honeypot + Zod + sanitise / DELETE admin-key); `DeskGuestbook.tsx` desktop app. Privacy policy
  (`en.ts` `legal.privacy`) updated to disclose stored name/message/timestamp + transient
  rate-limit IPs. **F0:** desk close-up art refreshed with konami-code sticky notes
  (`extract-monitor-hover.mjs` now re-emits both lamp states). **Also (unplanned):** `XtremeSplash`
  intro animation wrapping the room (`XtremeSplash.tsx`, 28 frames `public/room/xtreme-*.png` from
  `scripts/extract-xtreme.mjs`, plays once per load then reveals the room). Screen modes:
  `desktop | paint | minesweeper | readme | music | legal | links | guestbook | settings |
  terminal`. Desk icons gained Links + Guestbook. `DISCOVERY_IDS` gained `status`, `links`,
  `guestbook` (now 20; a review fix restored `settings`/`terminal`/`screensaver`, which an initial
  edit had dropped). Build green (`type-check && lint && build`).
- **v18** `23 September 2026`: Snake added as a desk app (`DeskSnake.tsx` + pure
  `src/lib/games/snake-engine.ts`), following the Minesweeper pattern exactly: new `snake` screen
  mode, `ICON_SNAKE` (inline SVG rects), a twelfth desktop shortcut (the icon grid is now an even
  4×3), `snake` discovery (now 23), `BEST_KEYS.snake`, `desk.snake`/`snakeTip`/`snakeApp` copy.
  Engine decisions: walls kill; turns are queued one slot deep and validated against the *applied*
  heading so two presses in one tick cannot reverse the snake into itself; the tail cell is legal to
  enter on the tick it is vacated; `tickMs = max(70, 140 - score*4)` so the interval is rebuilt only
  on a score change; filling the board wins rather than hanging in `placeFood`. Tests:
  `npm run test:snake` (9 cases, `node:test` via tsx). Design log: `todo.md` (SNK1–SNK4).
- **v19** `23 September 2026`: **Site icons finally work.** `public/favicon.svg` had been tracked
  since June but referenced nowhere, and Next's App Router only auto-detects icons in `src/app/`,
  never `public/` — so the site served no tab icon at all. Now `src/app/icon.png` (256, cropped to
  the red X, because the full lockup is illegible at 16–32 px) and `src/app/apple-icon.png` (180,
  full logo), both generated from `assets/site-logo.jpg` by `scripts/generate-icons.mjs`
  (`npm run icons`, needs `sharp`). Next emits the `<link>` tags by file convention, so
  `layout.tsx` needs no `icons` metadata. The logo source moved from the repo root to `assets/`
  (repo-internal source art, matching `assets/pixel-art/`); `public/site-logo.jpg` is a separate,
  lower-res copy that predates this and is untouched. `public/favicon.svg` is the retired "AH"
  monogram from the monochrome site and is now genuinely dead: delete it when convenient.
  **Links/webring app removed** end to end at the owner's request (`DeskLinks.tsx`,
  `src/lib/room/links.ts`, the `links` screen mode, shortcut, copy and the `links` discovery), so
  no dead code is left and the discoveries badge stays completable at **22**. Minesweeper's desk
  icon went 32 → 38 px (+20%).


- **v20** `26 September 2026`: **One desk chrome.** Every screen's 28px `ScreenStrip` is identical: a
  clock box at left (a button toggling 12/24 h via `DeskClockContext`, the desk time now honours
  `is24h`), an optional title, app controls, Full screen (where supported), Desktop (not on the
  desktop), ← Room, all `ArcadeButton tone="dark" size="sm"` (Pong's difficulty-box look; `StripButton`
  wraps it and blurs after pointer clicks so window-level game keys keep working). The cream
  page-corner To Room button is gone; ← Room lives in the desktop strip. `ArcadeButton`, `ARCADE` and
  `PIXEL_FONT` moved to `pixel-ui.tsx` (re-exported from `DeskArcade.tsx`, avoiding an import cycle).
  **Fullscreen** also for Paint, Minesweeper and Snake; in fullscreen `ArcadeFrame` scales the 536x308
  app above a 52px music bar with an embedded `NowPlaying` (the page-level player is outside the
  fullscreen element). **Blackjack**: player hands were offset twice by `left` and drew off the felt
  (fixed); discard tray, felt rules and lines removed (only BLACKJACK PAYS 3 TO 2 stays); a 6-page
  How to play tutorial (auto-opens once, `blackjack-tutorial-seen`; Escape closes only the dialog).
  **Reactive keyboard** (`DeskKeyboard.tsx`, `src/lib/room/keyboard-keys.ts`): 86 caps measured as
  exact pixel masks from the desk art; pressed caps sink 2px (capture-phase listener, never blocks
  keys). Room README popup removed. UI audit fixes: Paint clear needs a second click, Music app on the
  room palette, contrast fixes, focus returns to the launching icon, hint pulses inside `RoomStage`,
  splash skippable (click/key, instant on reduced motion), terminal and screensaver discoveries fire.

- **v22** `28-29 September 2026`: **Phones.** The room and desk are portrait-native and touch-first (the contract is
  "Phones" above). A portrait phone gets a 320 x h screen in a monitor bezel with a music bar; every desk app has a
  portrait layout: the desktop grid (4 columns), README, Legal, Guestbook (form above the entries, fields scrolled
  clear of the keyboard), Settings, Music, Movie, the terminal (desktop-only by the owner, but it reflows), Snake
  (a pixel D-pad plus swipes; the D-pad also sits beside the board on landscape touch screens), Minesweeper (a
  Reveal/Flag toggle), Paint (strokes now join their samples), Blackjack, Solitaire (tap to move for fingers; the
  mouse keeps click-to-select and double-click), Pong (the court turns vertical, drag your paddle, two players on
  two halves) and Breakout (a 304x400 portrait court carried in the engine state). Rotating mid-game keeps state.
  The room opens on the desk on phones, glides after a flick, answers taps with tooltips, and pans from anywhere
  (so does the landscape desk); the e-reader turns pages by swipe. Loading: apps are code-split and prefetched on
  idle (First Load JS for `/` 345 kB to 179 kB), effects play through Web Audio (each file fetched once), covers
  are 128x128 thumbnails (2.6 MB to 133 kB), music starts on a phone's first real tap. Desktop at 1408x768 is
  pixel-identical to v21 (checked with SSIM against the live site). Built by eight parallel deepcode builders in
  worktrees, reviewed by two deepcode reviews and the orchestrator; design, plan and log in `todo.md` (MOB0-MOB11).
  Tests: `npm run test:room` (37).

- **v23** `7 October 2026`: **Chess** added as a desk app (`DeskChess.tsx`, engine `src/lib/games/chess-engine.ts`,
  tests in `chess-engine.test.ts` via `npm run test:games`), following the Snake checklist: `chess` screen mode,
  dynamic import and `APP_CHUNKS` entry in DeskView, `ICON_CHESS` (a pixel knight), a sixteenth desktop shortcut,
  `chess` discovery (the badge is now completable at 27), `desk.chess`/`chessTip`/`chessApp` copy, `CHESS_SAVE_KEY`
  and `CHESS_STATS_KEY` in games storage. Vs CPU (four levels, White/Black/random) or two players with optional
  auto-flip; click, drag and keyboard input; promotion picker; Undo, Flip, Hint, Resign, Copy PGN; game-over
  panel with Play again/Review; saves and resumes. Portrait: a 38 px-square board under the strip, a status row,
  captured pieces when the screen is tall enough, a wrapping SAN list, and Undo/Flip/Hint/New in the toolbar row
  (Resign and PGN live in the New-game panel there); checked at 390x560, 390x640 and 390x844. The desktop grid
  went from 5 columns to 6 because a fourth row of icons no longer left room for the Terminal's desktop files.

- **v24** `7 October 2026`: **Mahjong** added as a desk app (see the `mahjong` paragraph under Desk view): Solitaire
  (three layouts) and 4-player Hong Kong against three bots, a seventeenth icon (`ICON_MAHJONG`), `mahjong` discovery
  (the badge is now completable at 28), `desk.mahjong`/`mahjongTip`/`mahjongApp` copy, `MAHJONG_*_KEY` storage keys,
  `npm run test:mahjong` (62). The portrait desktop grid now has five rows, so its icons shrank from 56 to 48 px.

- **v25** `7 October 2026`: **Shelf games and the bedside guestbook.** Eight pixel objects on the shelf (chess,
  mahjong, solitaire, blackjack, minesweeper, snake, pong, breakout), drawn by `scripts/draw-shelf-games.mjs` in the
  catan/books/vhs format (rest + 1 px and 2 px #f6da9c highlight, −2 px lift, tooltip); each opens its desk app on the
  monitor. The book under the side table opens the Guestbook. Labels in `room.shelfGameLabels` and
  `room.guestbookBookLabel`.

- **v26** `9 October 2026`: **Shelf games redrawn in the shelf's perspective.** `draw-shelf-games.mjs` is now a small
  oblique 3D projector (see the sprite pipeline): the objects sit deeper on the shelf at different depths and
  overlap like the books and tapes; chess is a full set (a board leaning on the back wall, six chessmen in front).
  Overlapping hotspots use pixel masks (AnimatedSprite `hitPath`, generated into `src/lib/room/shelf-games.ts`).

- **v21** `26 September 2026`: **Pixel Catan v3.** `/catan` works on desktop, tablet and phone (three layouts,
  bottom sheets, touch placement; `MobileGate` no longer blocks it) with game settings (points to win, friendly
  robber, board presets), Easy/Normal/Hard bots that trade with each other and with you, a trade panel, a results
  screen with charts, animations and Web Audio sounds, undo, keyboard shortcuts and a rebuilt tutorial. Saves moved
  to `catan-save-v2` (v1 saves migrate). Board sprite sizes changed with the owner's permission (SPEC.md lists
  them). Built by parallel deepcode builders in worktrees, reviewed by deepcode and a Claude workflow; design and
  task log in `todo.md` (CAT30-CAT41), architecture in the Pixel Catan section below.


- **v6 (security hardening)** `7 July 2026`: Deleted live Vercel OIDC token from
  `.vercel/.env.production.local` (never committed, now removed). Tightened contact CSRF
  check: absent Origin is now rejected in production (previously skipped). Escaped `<` and
  `-->` sequences in `JsonLd` component's serialized JSON as defense-in-depth against
  script-tag breakout. Documented leaderboard client-trust model in route source.
- Recurring session hazard: the agent sandbox's mount of this repo went stale repeatedly
  (phantom deletions, NUL-padded reads, unremovable `.git/index.lock`). Builds and `git
  status` from a sandbox are unreliable; trust direct file reads and run builds locally.

---

## Roadmap — Suggestions From Basic to Ambitious

Owner-curated backlog. Tiers are effort/scope, not priority order. ~~Struck~~ = done.

**Basic (hours)**
1. ~~Skip-no-repeat~~ — random advance, never repeats current (shared by skip + ended).
2. Desk session persistence: remember `screenMode`/`browserPath` in `sessionStorage`.
3. ~~Room OG image~~ — static 1200x630 crop of background.png at src/app/opengraph-image.png
   (scripts/generate-og-image.mjs); regenerate if the background art changes.
4. `/room` alias redirect to `/`.
5. ~~Visit odometer~~ — visitor counter next to clock (9820230).
6. Bonsai growth: resting frame advances with a `visits` counter in prefs (5 stages drawn).
7. ~~Volume control~~ — range slider on NowPlaying, volume pref in room-save-v1.

**Intermediate (a day or two each)**
8. Interaction SFX behind a separate `sfx` pref: icon clicks, poster flip, lamp switch, purr.
9. Monitor wallpaper unlocks: settings icon on the desk screen; stored in prefs.
10. Window weather: Open-Meteo API route (no key) with hourly cache; rain/snow overlays over
    the window; time-of-day tint already scaffolds this.
11. Cat on the bed: sleeping loop, wake/stretch on click, position varies by visit counter —
    needs new art through the union-bbox pipeline.
12. ~~Achievements/discoveries~~ (done v13): localStorage set + pixel toast + `aria-live=polite`;
    DiscoveriesBadge found/locked popup.
13. ~~Konami code → `terminal` screenMode~~ (done v13): `help`, `whoami`, `ls`, `cat readme.txt`,
    `clock`, `sfx on|off`, `clear`, `exit`.
14. ~~Mobile polish~~ (done v14): drag-to-pan, fill-height, ≥44px hit areas, idle preload.
15. Hardening (June audit carry-overs): ~~move the rate limiter to Upstash~~ (done — rl:* keys,
    in-memory fallback, getClientIp uses x-real-ip/rightmost XFF);
    ~~confirm the stray `VERCEL_OIDC_TOKEN` was never committed and delete it~~;
    consider CSP nonces to drop `unsafe-inline`.

**Ambitious (multi-day, design-heavy)**
16. Desktop OS expansion: draggable pixel windows on the monitor — file-explorer window
    mapping site content, the terminal, a music-player window; keep it same-origin DOM.
17. Playable arcade: Breakout as an "app" running inside the monitor screen (engine is
    already pure in `src/lib/games/breakout-engine.ts`).
18. Guestbook: pixel notebook on the desk writing short messages to Redis behind
    `src/services/` (validation + rate limiting per the contact pattern).
19. Seasonal/diurnal art variants: full day/night/season background sets via the generation
    pipeline; the lamp-off crossfade pattern generalises.
20. Ambient presence: anonymous "N people are in the room" via Redis presence counter.
21. Blog in the room: notebook object opens an MDX-backed `/blog` (needs `@next/mdx`,
    monochrome outside the room, dictionaries for chrome).
22. ~~Full French SEO~~ (moot — French removed July 2026; the site is English-only).
23. Regression net: Playwright E2E of the room flows (zoom, desk, iframe, audio, reduced
    motion) + Lighthouse CI on previews.
24. Admin dashboard under `/app/admin/` with middleware auth (service layer is ready).

---

## Games

`/games` hub links self-contained games; best scores in `localStorage`
(`src/lib/games/storage.ts`, namespaced `ahmed-site:games:v1:*`). The one server-backed
feature is the ninja leaderboard.

- **Typing test** (`/games/typing-test`): live WPM + accuracy; phrases dataset in
  `src/lib/games/phrases.ts` (law/AI governance/cyber; no silicon copy by design); pure math
  in `wpm.ts`.
- **Breakout** (`/games/breakout`): canvas + rAF, DPR-aware, pauses when hidden; physics and
  power-ups (`expand`/`multi`/`slow`/`life`) pure in `breakout-engine.ts`; `Breakout.tsx` is a
  thin shell.
- **Super Ninja Monk Fighter IV** (`/games/ninja`, v1.0): Godot 4.7 WASM export served as a
  standalone page (launch link opens `public/games/ninja/index.html` in a new tab; COOP/COEP +
  `wasm-unsafe-eval` CSP via `vercel.json`). Build updates: copy from `beam/build/web/`.
  Leaderboards: game POSTs `{name, timeCs, tokensPercent}` to `/api/ninja/leaderboard`
  (Zod, rate-limited, foreign Origin rejected, absent Origin allowed for desktop builds);
  Upstash sorted sets `ninja:lb:any` / `ninja:lb:100` via `services/leaderboard.ts`; page
  reads top 20 server-side, fails soft.

To add a game: card on the hub, route + shell under `(site)/games/<slug>/`, logic in
`src/lib/games/`, URL in `sitemap.ts`, strings in both dictionaries.

### Pixel Catan (`/catan`)
Offline singleplayer Catan (full base-game rules) against 2 or 3 bots, opened in a new tab by the room's shelf
Catan box; playable on desktop, tablet and phone. Not under `/games` (that path 301s to `/`). Design and task
log: `todo.md` (CAT0-CAT9 v1, CAT10-CAT16 v2, CAT30-CAT41 v3 overhaul, September 2026).
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

## Site-Wide Motion

Framer Motion only (no GSAP). Shared tokens in `src/lib/motion.ts` (`EASE_OUT_EXPO`,
`DURATION`, `fadeInUp`, `cardHover`, `springSubtle`). `(site)/template.tsx` provides the
per-route fade; `Header.tsx` has a shared-`layoutId` nav underline; `MotionCard` is the card
hover-lift. Every motion addition checks `useReducedMotion()`.

`CircuitMesh` (`src/components/ui/CircuitMesh.tsx`): canvas circuit-mesh backdrop for `(site)`
pages — monochrome, self-contained, reduced-motion renders one static frame, pauses when
hidden/off-screen, edge fade via CSS mask.

---

## Internationalisation (English-only)

French was removed in July 2026 (v12); the site is English-only. `src/lib/i18n/`:
`dictionaries/en.ts` (the single dictionary; its shape defines the `Dictionary` type),
`config.ts`, `server.ts` (`getDictionary`, always English), `client.tsx` (`I18nProvider`,
`useT()`). The provider/hook scaffolding is retained so components need no change and a second
locale could be reintroduced later, but there is no `fr.ts` and no language toggle.

Workflow for any copy change: edit `en.ts` → reference via `t.…` → `npm run type-check`. There
is no longer a second-language parity requirement.

---

## Contact System

```
POST /api/contact
  1. CSRF: Origin/Referer must match production domain
  2. Rate-limit by IP (5 req/hr, Upstash-backed fixed window — src/lib/ratelimit.ts;
     in-memory fallback in dev/outage; IP via getClientIp: x-real-ip then rightmost XFF)
  3. contactSchema.safeParse() server-side + honeypot ("website" must be empty)
  4. services/contact.ts → lazy Resend client → email
  5. 200 / 400 / 429 / 500
```
No database, no IP logging. The privacy policy (2026-06-16) matches this reality — keep it
accurate if data handling changes.

**Resend lazy init** (`src/lib/resend.ts`): the client is created only when sending —
`new Resend(undefined)` at module load breaks `next build` without the env var. Do not make
it eager. `CONTACT_EMAIL` constant lives here too. Subjects are sanitised.

---

## Fonts

`next/font/google` in root layout: Inter → `--font-sans`; Playfair Display → `--font-serif`
(headings via `globals.css`). Room-only: local Minecraft.ttf → `--font-pixel` (see room
section). Do not apply the pixel font to `(site)` pages.

---

## Security

Headers in `next.config.ts` `headers()` for all routes: HSTS, **X-Frame-Options DENY**,
X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP with
**`frame-ancestors 'none'`** (see Critical Constraint 6),
`X-Robots-Tag: noai, noimageai`. CSP retains `unsafe-inline` for scripts (Next.js trade-off).
`unsafe-eval` is added **only when `NODE_ENV === 'development'`**: the webpack dev runtime
evals modules, so without it `next dev` pages stay blank with a CSP EvalError. Production
(`next build`) never gets `unsafe-eval`; don't drop the NODE_ENV guard.
`vercel.json` sets COOP/COEP + game CSP for `/games/ninja/*` static files.

AI crawler blocking: `robots.ts` disallows GPTBot, ClaudeBot, Google-Extended, PerplexityBot,
CCBot, Bytespider, etc.; Terms prohibit scraping/AI training. Do not remove.

---

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | No | Defaults to `https://ahmedyhussain.com` |
| `GITHUB_TOKEN` | No | Raises API rate limit for the code page |
| `RESEND_API_KEY` | Retired | Contact form removed (Spec 1) |
| `CONTACT_TO_EMAIL` | Retired | Contact form removed (Spec 1) |
| `CONTACT_FROM_EMAIL` | Retired | Contact form removed (Spec 1) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Guestbook | Upstash Redis store for the guestbook (Spec F). Absent → guestbook fails soft. |
| `GUESTBOOK_ADMIN_KEY` | Guestbook | Secret for `DELETE /api/guestbook?id=&key=` (moderation escape hatch). |

Never commit `.env.local` / `.env`. (June audit flagged a stray `VERCEL_OIDC_TOKEN` in
`.env.local` — confirm never committed, then delete; see Roadmap item 15.)

---

## Common Tasks

- **New page:** `src/app/(site)/[route]/page.tsx`, export `metadata`, add to `sitemap.ts`,
  Header nav if appropriate, strings in both dictionaries.
- **New room object:** see the room Object registry section.
- **Run locally:** `cp .env.example .env.local` then `npm run dev`.
- **Pre-deploy:** `npm run type-check && npm run lint && npm run build`.

## What Does Not Exist Yet (deliberately)

Admin dashboard (service layer ready; `/app/admin/` + middleware auth when built), newsletter
(Resend audiences), blog (needs MDX; see Roadmap 21),
general-purpose database (constraint 3).
