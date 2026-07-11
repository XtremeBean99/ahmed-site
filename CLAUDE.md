# CLAUDE.md — AI Agent Context for ahmedyhussain.com

The single consolidated context document for this project. Read this before touching any code.
It absorbs the former `docs/PLAN.md` (spec history), `docs/taskt.txt` (original room brief),
`docs/audio-licences.md`, `docs/suggestions.txt` (June audit), and `assets/pixel-art/STYLE.md`,
all of which have been retired. Last consolidated: 6 July 2026.

---

## What This Project Is

A production personal website for **Ahmed Hussain** — BCom/LLB(Hons) candidate at ANU, Canberra.
Domain: `ahmedyhussain.com`
Repo: `https://github.com/XtremeBean99/ahmed-site`
Vercel project: `ahmed-site` (ID: `prj_lF32Zp1qlFEKH7XzEW3yUdddQm61`)

The homepage `/` is the **digital bedroom**: an interactive, room-only pixel-art experience.
The conventional site pages (`/home`, `/games`, `/projects`, `/tutoring`, `/legal`) were
retired in Spec 1 (July 2026) and 301-redirect to `/`. Their source code is archived under
`_archive/` — not part of the build, recoverable via `git mv`.

## Current State (7 July 2026)

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
scoped to `/` only. Do NOT add colour to any `(site)` page.

### 2. All user input is hostile
Two API routes exist. `src/app/api/weather/route.ts` is read-only (Open-Meteo, fixed Canberra,
hourly-cached, fail-soft, no key, no secrets — added in Spec E). `src/app/api/guestbook/route.ts`
**accepts user input** (Spec F, v17): its `POST` runs CSRF (Origin/Referer must match the prod
domain), IP rate-limiting (`src/lib/ratelimit.ts`, 5/hr, Upstash + in-memory fallback), a honeypot
(`website` must be empty), Zod validation (`guestbookSchema` in `src/lib/validations.ts`, name ≤ 32,
message ≤ 280), and control-char/HTML/profanity stripping before storing. `DELETE` requires
`GUESTBOOK_ADMIN_KEY`. Never skip server-side validation; if another input route is added, follow
this same pattern (mirrors the archived `_archive/services/contact.ts`).

### 3. Persistence is localStorage-first; the one server store is the guestbook
Room preferences live in `localStorage`, client-side only:
`room-save-v1` = `{ audio, lampOn, visitCount, volume, clock24h, sideTableOpen, sfx, sfxVolume, calmMode }`;
plus `room-paint-v1` (Paint canvas) and `room-discoveries-v1` (discoveries set). The **only**
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
Screen modes: `desktop | paint | minesweeper | readme | music | legal`. Desktop icons:
LinkedIn (external), GitHub (external), Music, Paint, Minesweeper, README, Legal.
`paint` (`DeskPaint.tsx`: 107×50 pixel canvas, 10-colour palette, pencil/eraser/fill tools,
persistent to `room-paint-v1`, PNG download), `minesweeper` (`DeskMinesweeper.tsx`: 9×9/10
mines, pure engine in `src/lib/games/minesweeper-engine.ts`, first-click safety,
right-click/long-press/F-key flagging, roving-tabindex keyboard play, best-time
localStorage), `readme` (`DeskReadme.tsx`: renders `site-text.txt`), `music`
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
of an MP3 and extracts APIC (attached picture) frames.

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
`clock24h` pref).
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
- `poster/` — kitagawa poster frames (`kitagawa-1..5.png`)
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
side-table-1..2 (641,409 232×210) · side-table-clock (658,386 71×55) — both extracted by
scripts/extract-side-table.mjs from assets/pixel-art/background/.
Background (`background.png`, ~55 KB) loads `fetchpriority="high"` as the LCP element.

### Audio licences (former audio-licences.md)
Owner direction 6 July 2026: deployment treated as private/testing; commercial recordings ship
at the owner's informed risk; revisit before public promotion. The domain is publicly
reachable. (General information, not legal advice.) Tracks in `public/audio/`:
cant-look-in-my-eyes ⚠ commercial ·
remember-summer-days ⚠ commercial ·
sky-restaurant ⚠ commercial. Covers: sky-restaurant.jpg, summer-days.jpg.

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

Headers in `next.config.ts` `headers()` for all routes: HSTS, **X-Frame-Options SAMEORIGIN**,
X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP with
**`frame-ancestors 'self'`** (see Critical Constraint 6 — required by in-monitor browsing),
`X-Robots-Tag: noai, noimageai`. CSP retains `unsafe-inline` for scripts (Next.js trade-off).
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
