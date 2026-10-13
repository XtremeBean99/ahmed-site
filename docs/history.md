# Project history

Moved out of CLAUDE.md on 13 October 2026, verbatim. The session log, the full roadmap as it stood, and notes on the conventional site that was retired in July 2026 and deleted in commit `4a6f3cb` (recover from `4a6f3cb^` if ever needed). Treat everything here as history, not current fact.

## Session history (condensed from the retired PLAN.md specs)
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
  `npm run test:snake` (9 cases, `node:test` via tsx). Design log: `docs/archive/todo-2026.md` (SNK1–SNK4).
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
  worktrees, reviewed by two deepcode reviews and the orchestrator; design, plan and log in `docs/archive/todo-2026.md` (MOB0-MOB11).
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

- **v27** `9 October 2026`: **How to play for every desk game, Mahjong table animation and tile tooltips.** The
  Blackjack dialog became the shared `GameTutorial.tsx` (paged dialog, `useTutorial` auto-opens once per game via a
  `<game>-tutorial-seen` key, `TutorialButton` "?" in the strip, `KeyRows`/`TermRows`; chrome copy in `desk.tutorial`,
  pages in each game's `tutorial` labels). Chess, Solitaire, Minesweeper, Snake, Pong, Breakout and both Mahjong
  modes have one; real-time games and clocks pause while it is open, and its capture-phase key handler swallows the
  game's keys. Mahjong also gained the automatic-table deal animation and hover tooltips explaining each tile for
  visitors who do not read Chinese (see the `mahjong` paragraph under Desk view).

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
  task log in `docs/archive/todo-2026.md` (CAT30-CAT41), architecture in the Pixel Catan section below.


- **v6 (security hardening)** `7 July 2026`: Deleted live Vercel OIDC token from
  `.vercel/.env.production.local` (never committed, now removed). Tightened contact CSRF
  check: absent Origin is now rejected in production (previously skipped). Escaped `<` and
  `-->` sequences in `JsonLd` component's serialized JSON as defense-in-depth against
  script-tag breakout. Documented leaderboard client-trust model in route source.
- Recurring session hazard: the agent sandbox's mount of this repo went stale repeatedly
  (phantom deletions, NUL-padded reads, unremovable `.git/index.lock`). Builds and `git
  status` from a sandbox are unreliable; trust direct file reads and run builds locally.

---

## Roadmap as of 9 October 2026 — Suggestions From Basic to Ambitious

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

## Retired site notes (code deleted in 4a6f3cb)

### Old architecture

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

### Old /games hub

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

### Site-wide motion

Framer Motion only (no GSAP). Shared tokens in `src/lib/motion.ts` (`EASE_OUT_EXPO`,
`DURATION`, `fadeInUp`, `cardHover`, `springSubtle`). `(site)/template.tsx` provides the
per-route fade; `Header.tsx` has a shared-`layoutId` nav underline; `MotionCard` is the card
hover-lift. Every motion addition checks `useReducedMotion()`.

`CircuitMesh` (`src/components/ui/CircuitMesh.tsx`): canvas circuit-mesh backdrop for `(site)`
pages — monochrome, self-contained, reduced-motion renders one static frame, pauses when
hidden/off-screen, edge fade via CSS mask.

---

### Contact system

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

### Fonts

`next/font/google` in root layout: Inter → `--font-sans`; Playfair Display → `--font-serif`
(headings via `globals.css`). Room-only: local Minecraft.ttf → `--font-pixel` (see room
section). Do not apply the pixel font to `(site)` pages.

---
